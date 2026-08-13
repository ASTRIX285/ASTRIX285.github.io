import { AuthRecord, type OAuthTransaction, type SessionRecord, type Membership } from "./auth-record";
import { approvedReturnUrl, handlePreflight, json, withCors } from "./web";

export { AuthRecord };

const BUNGIE_AUTHORIZE = "https://www.bungie.net/en/oauth/authorize";
const BUNGIE_TOKEN = "https://www.bungie.net/platform/app/oauth/token/";
const BUNGIE_MEMBERSHIPS = "https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/";
const SESSION_COOKIE = "astrix_session";
const OAUTH_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  membership_id?: string;
};

type BungieMembershipResponse = {
  Response?: {
    destinyMemberships?: Array<{
      membershipType: number;
      membershipId: string;
      displayName?: string;
    }>;
    primaryMembershipId?: string;
  };
  ErrorCode?: number;
  Message?: string;
};

function randomToken(): string {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

function recordStub(env: Env, key: string): DurableObjectStub {
  return env.AUTH_RECORDS.get(env.AUTH_RECORDS.idFromName(key));
}

async function putRecord(env: Env, key: string, record: OAuthTransaction | SessionRecord): Promise<void> {
  const response = await recordStub(env, key).fetch("https://auth-record/record", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error(`auth_record_write_failed:${response.status}`);
}

async function takeOAuth(env: Env, state: string): Promise<OAuthTransaction | null> {
  const response = await recordStub(env, `oauth:${state}`).fetch("https://auth-record/take-oauth", { method: "POST" });
  if (!response.ok) return null;
  return response.json<OAuthTransaction>();
}

async function getSession(env: Env, sessionId: string): Promise<SessionRecord | null> {
  const response = await recordStub(env, `session:${sessionId}`).fetch("https://auth-record/record");
  if (!response.ok) return null;
  const value = await response.json<OAuthTransaction | SessionRecord>();
  return value.kind === "session" ? value : null;
}

async function deleteSession(env: Env, sessionId: string): Promise<void> {
  await recordStub(env, `session:${sessionId}`).fetch("https://auth-record/record", { method: "DELETE" });
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") || "";
  for (const pair of cookie.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionCookie(sessionId: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function startOAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = randomToken();
  const returnUrl = approvedReturnUrl(url.searchParams.get("return"), env);
  const tx: OAuthTransaction = {
    kind: "oauth-transaction",
    state,
    createdAt: Date.now(),
    returnUrl,
    used: false
  };
  await putRecord(env, `oauth:${state}`, tx);

  const authorize = new URL(BUNGIE_AUTHORIZE);
  authorize.searchParams.set("client_id", env.BUNGIE_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("redirect_uri", env.OAUTH_REDIRECT_URI);
  return Response.redirect(authorize.toString(), 302);
}

async function exchangeCode(code: string, env: Env): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.BUNGIE_CLIENT_ID,
    client_secret: env.BUNGIE_CLIENT_SECRET,
    redirect_uri: env.OAUTH_REDIRECT_URI
  });
  const response = await fetch(BUNGIE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error(`bungie_token_exchange_failed:${response.status}:${await response.text()}`);
  return response.json<TokenResponse>();
}

async function fetchMemberships(accessToken: string, env: Env): Promise<BungieMembershipResponse> {
  const response = await fetch(BUNGIE_MEMBERSHIPS, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-API-Key": env.BUNGIE_API_KEY,
      "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
    }
  });
  if (!response.ok) throw new Error(`bungie_memberships_failed:${response.status}:${await response.text()}`);
  return response.json<BungieMembershipResponse>();
}

async function oauthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return json({ error: "bungie_authorization_denied", detail: oauthError }, 400);
  if (!code || !state) return json({ error: "missing_oauth_parameters" }, 400);

  const tx = await takeOAuth(env, state);
  if (!tx || tx.state !== state || Date.now() - tx.createdAt > OAUTH_TTL_MS) {
    return json({ error: "invalid_or_expired_oauth_state" }, 400);
  }

  const token = await exchangeCode(code, env);
  const membershipData = await fetchMemberships(token.access_token, env);
  const destinyMemberships: Membership[] = (membershipData.Response?.destinyMemberships || []).map((m) => ({
    membershipType: m.membershipType,
    membershipId: m.membershipId,
    ...(m.displayName ? { displayName: m.displayName } : {})
  }));
  const primaryMembershipId = membershipData.Response?.primaryMembershipId || null;
  const activeDestinyMembership = destinyMemberships.find((m) => m.membershipId === primaryMembershipId) || destinyMemberships[0] || null;
  const now = Date.now();
  const sessionId = randomToken();
  const csrfToken = randomToken();
  const session: SessionRecord = {
    kind: "session",
    createdAt: now,
    lastUsedAt: now,
    absoluteExpiresAt: now + SESSION_TTL_MS,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || "",
    accessExpiresAt: now + token.expires_in * 1000,
    refreshExpiresAt: token.refresh_expires_in ? now + token.refresh_expires_in * 1000 : null,
    bungieMembershipId: token.membership_id || null,
    destinyMemberships,
    primaryMembershipId,
    activeDestinyMembership,
    csrfToken
  };
  await putRecord(env, `session:${sessionId}`, session);

  const returnUrl = new URL(tx.returnUrl);
  returnUrl.searchParams.set("bungie", "connected");
  return new Response(null, {
    status: 302,
    headers: {
      Location: returnUrl.toString(),
      "Set-Cookie": sessionCookie(sessionId, Math.floor(SESSION_TTL_MS / 1000)),
      "Cache-Control": "no-store"
    }
  });
}

async function sessionRoute(request: Request, env: Env): Promise<Response> {
  const sessionId = cookieValue(request, SESSION_COOKIE);
  if (!sessionId) return withCors(request, env, json({ authenticated: false }, 401));
  const session = await getSession(env, sessionId);
  if (!session || session.absoluteExpiresAt <= Date.now()) {
    if (session) await deleteSession(env, sessionId);
    return withCors(request, env, json({ authenticated: false }, 401, { "Set-Cookie": clearSessionCookie() }));
  }
  return withCors(request, env, json({
    authenticated: true,
    bungieMembershipId: session.bungieMembershipId,
    destinyMemberships: session.destinyMemberships,
    primaryMembershipId: session.primaryMembershipId,
    activeDestinyMembership: session.activeDestinyMembership,
    accessExpiresAt: session.accessExpiresAt
  }));
}

async function logoutRoute(request: Request, env: Env): Promise<Response> {
  const sessionId = cookieValue(request, SESSION_COOKIE);
  if (sessionId) await deleteSession(env, sessionId);
  return withCors(request, env, json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") return handlePreflight(request, env);
      if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/v1/health")) {
        return json({ service: "astrix-destiny-backend", status: "ready" });
      }
      if (request.method === "GET" && url.pathname === "/bungie/start") return startOAuth(request, env);
      if (request.method === "GET" && url.pathname === "/bungie/callback") return oauthCallback(request, env);
      if (request.method === "GET" && url.pathname === "/session") return sessionRoute(request, env);
      if (request.method === "POST" && url.pathname === "/logout") return logoutRoute(request, env);
      return json({ error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: "server_error" }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
