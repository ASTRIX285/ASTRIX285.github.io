import { AuthRecord, type OAuthTransaction, type SessionRecord, type Membership } from "./auth-record";
import { approvedReturnUrl, handlePreflight, json, withCors } from "./web";

export { AuthRecord };

const BUNGIE_AUTHORIZE = "https://www.bungie.net/en/oauth/authorize";
const BUNGIE_TOKEN = "https://www.bungie.net/platform/app/oauth/token/";
const BUNGIE_MEMBERSHIPS = "https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/";
const BUNGIE_PLATFORM = "https://www.bungie.net/Platform";
const SESSION_COOKIE = "astrix_session";
const OAUTH_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MANIFEST_COMPONENT_TYPES = new Set([
  "DestinyInventoryItemDefinition",
  "DestinySandboxPerkDefinition",
  "DestinyArtifactDefinition",
  "DestinyStatDefinition",
  "DestinySocketCategoryDefinition"
]);
const LIVE_DEFINITION_TYPES = new Set([
  ...MANIFEST_COMPONENT_TYPES,
  "DestinyDamageTypeDefinition",
  "DestinyBreakerTypeDefinition",
  "DestinyEquipableItemSetDefinition"
]);

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

type BungieApiResponse<T> = {
  Response?: T;
  ErrorCode?: number;
  ErrorStatus?: string;
  Message?: string;
};

type DestinyManifestResponse = {
  version?: string;
  jsonWorldComponentContentPaths?: Record<string, Record<string, string>>;
};

type DestinyItemComponent = { itemHash?: number; itemInstanceId?: string; overrideStyleItemHash?: number; versionNumber?: number; state?: number };
type DestinySocketComponent = { sockets?: Array<{ plugHash?: number }> };
type DestinyItemPlug = { plugItemHash?: number; plugHash?: number; canInsert?: boolean; enabled?: boolean };
type DestinyReusablePlugComponent = { plugs?: Record<string, DestinyItemPlug[]> };
type DestinyPlugSetsComponent = { plugs?: Record<string, DestinyItemPlug[]> };
type DestinyArtifactProfileScoped = { artifactHash?: number };
type DestinyArtifactTierItem = { itemHash?: number; isActive?: boolean; isVisible?: boolean };
type DestinyArtifactCharacterScoped = { tiers?: Array<{ items?: DestinyArtifactTierItem[] }> };
type DestinyLoadoutItemComponent = { itemInstanceId?: string; plugItemHashes?: number[] };
type DestinyLoadoutComponent = {
  colorHash?: number;
  iconHash?: number;
  nameHash?: number;
  items?: DestinyLoadoutItemComponent[];
  subclassOverrides?: DestinyLoadoutItemComponent[];
};
type DestinyProfilePayload = {
  characterEquipment?: { data?: Record<string, { items?: DestinyItemComponent[] }> };
  characterInventories?: { data?: Record<string, { items?: DestinyItemComponent[] }> };
  profileInventory?: { data?: { items?: DestinyItemComponent[] } };
  characterLoadouts?: { data?: Record<string, { loadouts?: DestinyLoadoutComponent[] }> };
  profileProgression?: { data?: { seasonalArtifact?: DestinyArtifactProfileScoped } };
  characterProgressions?: { data?: Record<string, { seasonalArtifact?: DestinyArtifactCharacterScoped }> };
  profilePlugSets?: { data?: DestinyPlugSetsComponent };
  characterPlugSets?: { data?: Record<string, DestinyPlugSetsComponent> };
  itemComponents?: {
    sockets?: { data?: Record<string, DestinySocketComponent> };
    instances?: { data?: Record<string, { damageTypeHash?: number; breakerTypeHash?: number; gearTier?: number; itemLevel?: number; quality?: number; primaryStat?: { value?: number } }> };
    reusablePlugs?: { data?: Record<string, DestinyReusablePlugComponent> };
  };
  [key: string]: unknown;
};

const PROFILE_COMPONENTS = [
  100, // Profiles
  102, // ProfileInventories
  103, // ProfileCurrencies
  104, // ProfileProgression
  200, // Characters
  201, // CharacterInventories
  202, // CharacterProgressions
  203, // CharacterRenderData
  204, // CharacterActivities
  205, // CharacterEquipment
  206, // CharacterLoadouts
  300, // ItemInstances
  302, // ItemPerks
  304, // ItemStats
  305, // ItemSockets
  309, // ItemPlugObjectives
  310  // ItemReusablePlugs
] as const;

function randomToken(): string {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

function publicBungieHeaders(env: Env): HeadersInit {
  return {
    "X-API-Key": env.BUNGIE_API_KEY,
    "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
  };
}

async function destinyManifest(env: Env): Promise<DestinyManifestResponse> {
  const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/`, { headers: publicBungieHeaders(env) });
  const payload = await response.json<BungieApiResponse<DestinyManifestResponse>>().catch(() => null);
  if (!response.ok || !payload?.Response?.version || !payload.Response.jsonWorldComponentContentPaths?.en) {
    throw new Error(`bungie_manifest_failed:${response.status}`);
  }
  return payload.Response;
}

async function manifestMetadataRoute(request: Request, env: Env): Promise<Response> {
  const manifest = await destinyManifest(env);
  const english = manifest.jsonWorldComponentContentPaths?.en || {};
  const paths = Object.fromEntries([...MANIFEST_COMPONENT_TYPES].map(type => [type, english[type]]).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  if (Object.keys(paths).length !== MANIFEST_COMPONENT_TYPES.size) {
    return withCors(request, env, json({ error: "bungie_manifest_component_path_missing" }, 502));
  }
  return withCors(request, env, json({ version: manifest.version, jsonWorldComponentContentPaths: { en: paths } }, 200, { "Cache-Control": "no-cache" }));
}

async function manifestComponentRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const requestedVersion = url.searchParams.get("version") || "";
  if (!MANIFEST_COMPONENT_TYPES.has(type) || !requestedVersion) {
    return withCors(request, env, json({ error: "invalid_manifest_component_request" }, 400));
  }
  const manifest = await destinyManifest(env);
  if (manifest.version !== requestedVersion) {
    return withCors(request, env, json({ error: "manifest_version_changed", requestedVersion, currentVersion: manifest.version }, 409));
  }
  const path = manifest.jsonWorldComponentContentPaths?.en?.[type] || "";
  if (!path.startsWith("/common/destiny2_content/json/")) {
    return withCors(request, env, json({ error: "invalid_manifest_component_path" }, 502));
  }
  const bungieUrl = new URL(path, "https://www.bungie.net");
  if (bungieUrl.origin !== "https://www.bungie.net") {
    return withCors(request, env, json({ error: "invalid_manifest_component_origin" }, 502));
  }
  const upstream = await fetch(bungieUrl, { headers: { "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)" } });
  if (!upstream.ok || !upstream.body) {
    return withCors(request, env, json({ error: "bungie_manifest_component_failed", status: upstream.status }, 502));
  }
  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "X-Manifest-Version": requestedVersion
  });
  return withCors(request, env, new Response(upstream.body, { status: 200, headers }));
}

async function manifestDefinitionRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const hash = url.searchParams.get("hash") || "";
  if (!LIVE_DEFINITION_TYPES.has(type) || !/^\d+$/.test(hash)) {
    return withCors(request, env, json({ error: "invalid_manifest_definition_request" }, 400));
  }
  const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/${type}/${hash}/`, { headers: publicBungieHeaders(env) });
  const payload = await response.json<BungieApiResponse<Record<string, unknown>>>().catch(() => null);
  if (!response.ok || !payload?.Response) {
    return withCors(request, env, json({ error: "bungie_manifest_definition_failed", status: response.status }, response.status === 404 ? 404 : 502));
  }
  return withCors(request, env, json({ type, hash: Number(hash), definition: payload.Response }, 200, { "Cache-Control": "public, max-age=604800" }));
}

function bindingInfo(value: unknown): { present: boolean; type: string; length: number | null } {
  return {
    present: typeof value === "string" ? value.length > 0 : value != null,
    type: typeof value,
    length: typeof value === "string" ? value.length : null
  };
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

async function putSession(env: Env, sessionId: string, session: SessionRecord): Promise<void> {
  await putRecord(env, `session:${sessionId}`, session);
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
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

async function startOAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const clientId = (env.BUNGIE_CLIENT_ID || "").trim();
  if (!clientId) {
    return json({ error: "oauth_not_configured", missing: ["BUNGIE_CLIENT_ID"] }, 500);
  }

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
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", state);
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

async function refreshAccessToken(sessionId: string, session: SessionRecord, env: Env): Promise<SessionRecord> {
  if (session.accessExpiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken || (session.refreshExpiresAt !== null && session.refreshExpiresAt <= Date.now())) {
    throw new Error("bungie_reauthentication_required");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
    client_id: env.BUNGIE_CLIENT_ID,
    client_secret: env.BUNGIE_CLIENT_SECRET
  });
  const response = await fetch(BUNGIE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error(`bungie_token_refresh_failed:${response.status}`);

  const token = await response.json<TokenResponse>();
  const now = Date.now();
  const refreshed: SessionRecord = {
    ...session,
    lastUsedAt: now,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || session.refreshToken,
    accessExpiresAt: now + token.expires_in * 1000,
    refreshExpiresAt: token.refresh_expires_in ? now + token.refresh_expires_in * 1000 : session.refreshExpiresAt
  };
  await putSession(env, sessionId, refreshed);
  return refreshed;
}

function equippedDefinitionHashes(profile: DestinyProfilePayload): number[] {
  const hashes = new Set<number>();
  const equipment = profile.characterEquipment?.data || {};
  for (const character of Object.values(equipment)) {
    for (const item of character.items || []) {
      if (Number.isInteger(item.itemHash)) hashes.add(Number(item.itemHash));
      if (Number.isInteger(item.overrideStyleItemHash)) hashes.add(Number(item.overrideStyleItemHash));
      if (!item.itemInstanceId) continue;
      const socketData = profile.itemComponents?.sockets?.data?.[item.itemInstanceId];
      for (const socket of socketData?.sockets || []) {
        if (Number.isInteger(socket.plugHash)) hashes.add(Number(socket.plugHash));
      }
    }
  }
  return [...hashes];
}

async function fetchManifestDefinitions(type: string, hashes: number[], accessToken: string, env: Env): Promise<Record<string, Record<string, unknown>>> {
  const entries = await Promise.all([...new Set(hashes.filter(Number.isInteger))].map(async hash => {
    const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/${type}/${hash}/`, { headers: { Authorization: `Bearer ${accessToken}`, "X-API-Key": env.BUNGIE_API_KEY, "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)" } });
    if (!response.ok) return null;
    const payload = await response.json<BungieApiResponse<Record<string, unknown>>>().catch(() => null);
    return payload?.Response ? [String(hash), payload.Response] as const : null;
  }));
  const definitions: Record<string, Record<string, unknown>> = {};
  for (const entry of entries) if (entry) definitions[entry[0]] = entry[1];
  return definitions;
}

function artifactPerkHashes(profile: DestinyProfilePayload): number[] {
  const hashes = new Set<number>();
  for (const progression of Object.values(profile.characterProgressions?.data || {})) {
    for (const tier of progression.seasonalArtifact?.tiers || []) {
      for (const item of tier.items || []) {
        if (Number.isInteger(item.itemHash)) hashes.add(Number(item.itemHash));
      }
    }
  }
  return [...hashes];
}

function definitionPlugCategory(definition: Record<string, unknown> | undefined): string {
  const plug = definition?.plug as { plugCategoryIdentifier?: unknown } | undefined;
  return String(plug?.plugCategoryIdentifier || "").toLowerCase();
}

function reusableSubclassPlugHashes(
  profile: DestinyProfilePayload,
  definitions: Record<string, Record<string, unknown>>
): number[] {
  const hashes = new Set<number>();
  for (const [characterId, character] of Object.entries(profile.characterEquipment?.data || {})) {
    for (const item of character.items || []) {
      if (!item.itemInstanceId) continue;
      const itemDefinition = definitions[String(item.itemHash)] || {};
      const typeName = String(itemDefinition.itemTypeDisplayName || "").toLowerCase();
      const displayName = String((itemDefinition.displayProperties as { name?: unknown } | undefined)?.name || "").toLowerCase();
      if (!typeName.includes("subclass") && !displayName.includes("subclass")) continue;
      const reusable = profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs || {};
      for (const rows of Object.values(reusable)) {
        for (const row of rows || []) {
          const hash = row.plugItemHash ?? row.plugHash;
          if (Number.isInteger(hash)) hashes.add(Number(hash));
        }
      }
      const socketEntries = (itemDefinition.sockets as { socketEntries?: Array<{ reusablePlugSetHash?: number }> } | undefined)?.socketEntries || [];
      const plugSets = [profile.profilePlugSets?.data?.plugs, profile.characterPlugSets?.data?.[characterId]?.plugs];
      for (const entry of socketEntries) {
        const plugSetHash = Number(entry.reusablePlugSetHash);
        if (!Number.isInteger(plugSetHash)) continue;
        for (const plugs of plugSets) {
          for (const row of plugs?.[String(plugSetHash)] || []) {
            if (row.canInsert === false || row.enabled === false) continue;
            const hash = row.plugItemHash ?? row.plugHash;
            if (Number.isInteger(hash)) hashes.add(Number(hash));
          }
        }
      }
    }
  }
  return [...hashes];
}

async function fetchInventoryDefinitions(
  hashes: number[],
  accessToken: string,
  env: Env
): Promise<Record<string, Record<string, unknown>>> {
  const uniqueHashes = [...new Set(hashes.filter(hash => Number.isInteger(hash)))];
  const definitions: Record<string, Record<string, unknown>> = {};
  let cache: Cache | null = null;

  try {
    cache = await caches.open("astrix-bungie-definitions");
  } catch (error) {
    console.warn("definition_cache_open_failed", { error: String(error) });
  }

  // Keep outbound Bungie work at six concurrent requests, matching Cloudflare's
  // simultaneous outgoing-connection limit, while resolving every required hash.
  const batchSize = 6;
  for (let offset = 0; offset < uniqueHashes.length; offset += batchSize) {
    const batch = uniqueHashes.slice(offset, offset + batchSize);
    const entries = await Promise.all(batch.map(async (hash) => {
      const cacheKey = new Request(`https://auth.astrixparadox.com/.cache/inventory/${hash}`, { method: "GET" });
      if (cache) {
        try {
          const cached = await cache.match(cacheKey);
          if (cached) {
            const definition = await cached.json<Record<string, unknown>>().catch(() => null);
            if (definition) return [String(hash), definition] as const;
          }
        } catch (error) {
          console.warn("definition_cache_read_failed", { hash, error: String(error) });
        }
      }

      const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-API-Key": env.BUNGIE_API_KEY,
          "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
        }
      });
      if (!response.ok) return null;
      const payload = await response.json<BungieApiResponse<Record<string, unknown>>>().catch(() => null);
      if (!payload?.Response) return null;

      if (cache) {
        try {
          await cache.put(cacheKey, new Response(JSON.stringify(payload.Response), {
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=604800" }
          }));
        } catch (error) {
          console.warn("definition_cache_write_failed", { hash, error: String(error) });
        }
      }
      return [String(hash), payload.Response] as const;
    }));

    for (const entry of entries) {
      if (entry) definitions[entry[0]] = entry[1];
    }
  }

  return definitions;
}

async function fetchArtifactDefinition(
  hash: number | null,
  accessToken: string,
  env: Env
): Promise<Record<string, unknown> | null> {
  if (!Number.isInteger(hash)) return null;
  let cache: Cache | null = null;
  const cacheKey = new Request(`https://auth.astrixparadox.com/.cache/artifact/${hash}`, { method: "GET" });
  try {
    cache = await caches.open("astrix-bungie-definitions");
    const cached = await cache.match(cacheKey);
    if (cached) {
      const definition = await cached.json<Record<string, unknown>>().catch(() => null);
      if (definition) return definition;
    }
  } catch (error) {
    console.warn("artifact_definition_cache_read_failed", { hash, error: String(error) });
  }

  const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/DestinyArtifactDefinition/${hash}/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-API-Key": env.BUNGIE_API_KEY,
      "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
    }
  });
  if (!response.ok) return null;
  const payload = await response.json<BungieApiResponse<Record<string, unknown>>>().catch(() => null);
  if (!payload?.Response) return null;

  if (cache) {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(payload.Response), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=604800" }
      }));
    } catch (error) {
      console.warn("artifact_definition_cache_write_failed", { hash, error: String(error) });
    }
  }
  return payload.Response;
}

async function fetchGearAssetDefinitions(
  hashes: number[],
  accessToken: string,
  env: Env
): Promise<Record<string, Record<string, unknown>>> {
  // Character assembly needs Bungie's geometry, textures and dye metadata.
  const entries = await Promise.all(hashes.slice(0, 12).map(async (hash) => {
    const cache = await caches.open("astrix-bungie-definitions");
    const cacheKey = new Request(`https://astrix-definition-cache.invalid/gear/${hash}`, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      const definition = await cached.json<Record<string, unknown>>().catch(() => null);
      if (definition) return [String(hash), definition] as const;
    }
    const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/DestinyGearAssetsDefinition/${hash}/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-API-Key": env.BUNGIE_API_KEY,
        "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
      }
    });
    if (!response.ok) return null;
    const payload = await response.json<BungieApiResponse<Record<string, unknown>>>().catch(() => null);
    if (!payload?.Response) return null;
    await cache.put(cacheKey, new Response(JSON.stringify(payload.Response), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=604800" }
    }));
    return [String(hash), payload.Response] as const;
  }));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, Record<string, unknown>] => entry !== null));
}

async function profileRoute(request: Request, env: Env): Promise<Response> {
  const sessionId = cookieValue(request, SESSION_COOKIE);
  if (!sessionId) return withCors(request, env, json({ authenticated: false, error: "authentication_required" }, 401));

  const storedSession = await getSession(env, sessionId);
  if (!storedSession || storedSession.absoluteExpiresAt <= Date.now()) {
    if (storedSession) await deleteSession(env, sessionId);
    return withCors(request, env, json(
      { authenticated: false, error: "session_expired" },
      401,
      { "Set-Cookie": clearSessionCookie() }
    ));
  }

  if (!storedSession.activeDestinyMembership) {
    return withCors(request, env, json({ error: "destiny_membership_not_found" }, 404));
  }

  let session: SessionRecord;
  try {
    session = await refreshAccessToken(sessionId, storedSession, env);
  } catch (error) {
    if (error instanceof Error && error.message === "bungie_reauthentication_required") {
      await deleteSession(env, sessionId);
      return withCors(request, env, json(
        { authenticated: false, error: "bungie_reauthentication_required" },
        401,
        { "Set-Cookie": clearSessionCookie() }
      ));
    }
    throw error;
  }

  const membership = session.activeDestinyMembership;
  if (!membership) {
    return withCors(request, env, json({ error: "destiny_membership_not_found" }, 404));
  }
  const profileUrl = new URL(
    `${BUNGIE_PLATFORM}/Destiny2/${membership.membershipType}/Profile/${encodeURIComponent(membership.membershipId)}/`
  );
  profileUrl.searchParams.set("components", PROFILE_COMPONENTS.join(","));

  const response = await fetch(profileUrl, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "X-API-Key": env.BUNGIE_API_KEY,
      "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
    }
  });
  const payload = await response.json<BungieApiResponse<DestinyProfilePayload>>().catch(() => null);
  if (!response.ok || !payload?.Response) {
    console.error("bungie_profile_failed", {
      status: response.status,
      errorCode: payload?.ErrorCode,
      errorStatus: payload?.ErrorStatus
    });
    return withCors(request, env, json({
      error: "bungie_profile_failed",
      status: response.status,
      errorCode: payload?.ErrorCode ?? null,
      errorStatus: payload?.ErrorStatus ?? null
    }, response.status >= 400 && response.status < 500 ? response.status : 502));
  }

  if (new URL(request.url).searchParams.get("definitions") === "client-manifest") {
    await putSession(env, sessionId, { ...session, lastUsedAt: Date.now() });
    return withCors(request, env, json({
      authenticated: true,
      membership,
      components: PROFILE_COMPONENTS,
      profile: payload.Response,
      definitions: {},
      damageDefinitions: {},
      breakerDefinitions: {},
      gearAssets: {},
      manifestResolution: { mode: "client" }
    }));
  }

  const baseDefinitionHashes = [...new Set([
    ...equippedDefinitionHashes(payload.Response),
    ...artifactPerkHashes(payload.Response)
  ])];
  const definitions = await fetchInventoryDefinitions(baseDefinitionHashes, session.accessToken, env);
  const reusableSubclassDefinitionHashes = reusableSubclassPlugHashes(payload.Response, definitions);
  const missingReusableSubclassHashes = reusableSubclassDefinitionHashes.filter(hash => !definitions[String(hash)]);
  if (missingReusableSubclassHashes.length) {
    Object.assign(definitions, await fetchInventoryDefinitions(missingReusableSubclassHashes, session.accessToken, env));
  }

  const requestedDefinitionHashes = [...new Set([...baseDefinitionHashes, ...reusableSubclassDefinitionHashes])];
  const damageTypeHashes = [...new Set(Object.values(payload.Response.itemComponents?.instances?.data || {}).map(row => Number(row.damageTypeHash)).filter(Number.isInteger))];
  const breakerTypeHashes = [...new Set([...Object.values(definitions).map(row => Number(row.breakerTypeHash)),...Object.values(payload.Response.itemComponents?.instances?.data || {}).map(row => Number(row.breakerTypeHash))].filter(Number.isInteger))];
  const [damageDefinitions, breakerDefinitions] = await Promise.all([
    fetchManifestDefinitions("DestinyDamageTypeDefinition", damageTypeHashes, session.accessToken, env),
    fetchManifestDefinitions("DestinyBreakerTypeDefinition", breakerTypeHashes, session.accessToken, env)
  ]);
  const unresolvedDefinitionHashes = requestedDefinitionHashes.filter(hash => !definitions[String(hash)]);
  const definitionCoverage = {
    requested: requestedDefinitionHashes.length,
    resolved: requestedDefinitionHashes.length - unresolvedDefinitionHashes.length,
    unresolved: unresolvedDefinitionHashes,
    complete: unresolvedDefinitionHashes.length === 0,
    characterCount: Object.keys(payload.Response.characterEquipment?.data || {}).length,
    reusableSubclassRequested: reusableSubclassDefinitionHashes.length,
    artifactPerkRequested: artifactPerkHashes(payload.Response).length
  };

  const artifactHashValue = payload.Response.profileProgression?.data?.seasonalArtifact?.artifactHash;
  const artifactHash = Number.isInteger(artifactHashValue) ? Number(artifactHashValue) : null;
  const artifactDefinition = await fetchArtifactDefinition(artifactHash, session.accessToken, env);
  const artifactCoverage = {
    hash: artifactHash,
    definitionResolved: Boolean(artifactDefinition),
    perkHashes: artifactPerkHashes(payload.Response),
    unresolvedPerkHashes: artifactPerkHashes(payload.Response).filter(hash => !definitions[String(hash)]),
    complete: artifactHash === null ? true : Boolean(artifactDefinition)
  };

  const gearAssets: Record<string, Record<string, unknown>> = {};
  const updatedSession = { ...session, lastUsedAt: Date.now() };
  await putSession(env, sessionId, updatedSession);
  return withCors(request, env, json({
    authenticated: true,
    membership,
    components: PROFILE_COMPONENTS,
    profile: payload.Response,
    definitions,
    damageDefinitions,
    breakerDefinitions,
    definitionCoverage,
    artifactDefinition,
    artifactCoverage,
    gearAssets
  }));
}

function allProfileItems(profile: DestinyProfilePayload): DestinyItemComponent[] {
  const rows: DestinyItemComponent[] = [];
  rows.push(...(profile.profileInventory?.data?.items || []));
  for (const inventory of Object.values(profile.characterInventories?.data || {})) rows.push(...(inventory.items || []));
  for (const equipment of Object.values(profile.characterEquipment?.data || {})) rows.push(...(equipment.items || []));
  return rows;
}

async function loadoutRoute(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const characterId = requestUrl.searchParams.get("characterId") || "";
  const index = Number(requestUrl.searchParams.get("index"));
  if (!characterId || !Number.isInteger(index) || index < 0 || index > 19) {
    return withCors(request, env, json({ error: "invalid_loadout_selection" }, 400));
  }

  const sessionId = cookieValue(request, SESSION_COOKIE);
  if (!sessionId) return withCors(request, env, json({ authenticated: false, error: "authentication_required" }, 401));
  const storedSession = await getSession(env, sessionId);
  if (!storedSession || storedSession.absoluteExpiresAt <= Date.now()) {
    if (storedSession) await deleteSession(env, sessionId);
    return withCors(request, env, json({ authenticated: false, error: "session_expired" }, 401, { "Set-Cookie": clearSessionCookie() }));
  }
  if (!storedSession.activeDestinyMembership) {
    return withCors(request, env, json({ error: "destiny_membership_not_found" }, 404));
  }

  let session: SessionRecord;
  try {
    session = await refreshAccessToken(sessionId, storedSession, env);
  } catch (error) {
    if (error instanceof Error && error.message === "bungie_reauthentication_required") {
      await deleteSession(env, sessionId);
      return withCors(request, env, json({ authenticated: false, error: "bungie_reauthentication_required" }, 401, { "Set-Cookie": clearSessionCookie() }));
    }
    throw error;
  }

  const membership = session.activeDestinyMembership;
  if (!membership) return withCors(request, env, json({ error: "destiny_membership_not_found" }, 404));
  const profileUrl = new URL(`${BUNGIE_PLATFORM}/Destiny2/${membership.membershipType}/Profile/${encodeURIComponent(membership.membershipId)}/`);
  profileUrl.searchParams.set("components", PROFILE_COMPONENTS.join(","));
  const response = await fetch(profileUrl, { headers: {
    Authorization: `Bearer ${session.accessToken}`,
    "X-API-Key": env.BUNGIE_API_KEY,
    "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
  }});
  const payload = await response.json<BungieApiResponse<DestinyProfilePayload>>().catch(() => null);
  if (!response.ok || !payload?.Response) {
    return withCors(request, env, json({ error: "bungie_loadout_profile_failed", status: response.status }, 502));
  }

  const profile = payload.Response;
  const loadout = profile.characterLoadouts?.data?.[characterId]?.loadouts?.[index];
  if (!loadout || (!(loadout.items?.length) && !(loadout.subclassOverrides?.length))) {
    return withCors(request, env, json({ error: "loadout_not_found" }, 404));
  }
  const byInstance = new Map(allProfileItems(profile).filter(item => item.itemInstanceId).map(item => [String(item.itemInstanceId), item]));
  const selectedRows = [...(loadout.items || []), ...(loadout.subclassOverrides || [])];
  const selectedByInstance = new Map<string, DestinyItemComponent & { plugItemHashes: number[] }>();
  for (const row of selectedRows) {
    const id = String(row.itemInstanceId || "");
    const item = id ? byInstance.get(id) : undefined;
    if (!item) continue;
    const prior = selectedByInstance.get(id);
    selectedByInstance.set(id, { ...item, plugItemHashes: row.plugItemHashes?.length ? row.plugItemHashes : (prior?.plugItemHashes || []) });
  }
  const selectedItems = [...selectedByInstance.values()];
  if (requestUrl.searchParams.get("definitions") === "client-manifest") {
    await putSession(env, sessionId, { ...session, lastUsedAt: Date.now() });
    return withCors(request, env, json({
      authenticated: true,
      membership,
      characterId,
      index,
      loadout,
      selectedItems,
      profile,
      definitions: {},
      damageDefinitions: {},
      breakerDefinitions: {},
      gearAssets: {},
      manifestResolution: { mode: "client" }
    }));
  }
  const definitionHashes = new Set<number>();
  for (const item of selectedItems) {
    if (Number.isInteger(item.itemHash)) definitionHashes.add(Number(item.itemHash));
    if (Number.isInteger(item.overrideStyleItemHash)) definitionHashes.add(Number(item.overrideStyleItemHash));
  }
  for (const item of selectedItems) {
    for (const plugHash of item.plugItemHashes) {
      if (Number.isInteger(plugHash)) definitionHashes.add(Number(plugHash));
    }
  }
  const hashes = [...definitionHashes];
  const definitions = await fetchInventoryDefinitions(hashes, session.accessToken, env);
  const selectedInstances = selectedItems.map(item => item.itemInstanceId ? profile.itemComponents?.instances?.data?.[item.itemInstanceId] : null).filter(Boolean);
  const damageTypeHashes = [...new Set(selectedInstances.map(row => Number(row?.damageTypeHash)).filter(Number.isInteger))];
  const breakerTypeHashes = [...new Set([...Object.values(definitions).map(row => Number(row.breakerTypeHash)),...selectedInstances.map(row => Number(row?.breakerTypeHash))].filter(Number.isInteger))];
  const [damageDefinitions, breakerDefinitions] = await Promise.all([
    fetchManifestDefinitions("DestinyDamageTypeDefinition", damageTypeHashes, session.accessToken, env),
    fetchManifestDefinitions("DestinyBreakerTypeDefinition", breakerTypeHashes, session.accessToken, env)
  ]);
  const unresolvedDefinitionHashes = hashes.filter(hash => !definitions[String(hash)]);
  const definitionCoverage = {
    requested: hashes.length,
    resolved: Object.keys(definitions).length,
    unresolved: unresolvedDefinitionHashes,
    complete: unresolvedDefinitionHashes.length === 0
  };
  const gearAssets: Record<string, Record<string, unknown>> = {};
  await putSession(env, sessionId, { ...session, lastUsedAt: Date.now() });
  return withCors(request, env, json({
    authenticated: true,
    membership,
    characterId,
    index,
    loadout,
    selectedItems,
    profile,
    definitions,
    damageDefinitions,
    breakerDefinitions,
    definitionCoverage,
    gearAssets
  }));
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

async function authenticatedSession(
  request: Request,
  env: Env
): Promise<{ sessionId: string; session: SessionRecord } | Response> {
  const sessionId = cookieValue(request, SESSION_COOKIE);
  if (!sessionId) {
    return withCors(request, env, json({ authenticated: false, error: "authentication_required" }, 401));
  }

  const storedSession = await getSession(env, sessionId);
  if (!storedSession || storedSession.absoluteExpiresAt <= Date.now()) {
    if (storedSession) await deleteSession(env, sessionId);
    return withCors(request, env, json(
      { authenticated: false, error: "session_expired" },
      401,
      { "Set-Cookie": clearSessionCookie() }
    ));
  }

  try {
    const session = await refreshAccessToken(sessionId, storedSession, env);
    return { sessionId, session };
  } catch (error) {
    if (error instanceof Error && error.message === "bungie_reauthentication_required") {
      await deleteSession(env, sessionId);
      return withCors(request, env, json(
        { authenticated: false, error: "bungie_reauthentication_required" },
        401,
        { "Set-Cookie": clearSessionCookie() }
      ));
    }
    throw error;
  }
}

function bungieHeaders(session: SessionRecord, env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${session.accessToken}`,
    "X-API-Key": env.BUNGIE_API_KEY,
    "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
  };
}

async function activityHistoryRoute(request: Request, env: Env): Promise<Response> {
  const auth = await authenticatedSession(request, env);
  if (auth instanceof Response) return auth;

  const membership = auth.session.activeDestinyMembership;
  if (!membership) {
    return withCors(request, env, json({ error: "destiny_membership_not_found" }, 404));
  }

  const requestUrl = new URL(request.url);
  const membershipType = Number(requestUrl.searchParams.get("membershipType"));
  const membershipId = requestUrl.searchParams.get("membershipId")?.trim() || "";
  const characterId = requestUrl.searchParams.get("characterId")?.trim() || "";
  const count = Number(requestUrl.searchParams.get("count") ?? 25);
  const page = Number(requestUrl.searchParams.get("page") ?? 0);

  if (
    !Number.isInteger(membershipType) ||
    !/^\d+$/.test(membershipId) ||
    !/^\d+$/.test(characterId) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 25 ||
    !Number.isInteger(page) ||
    page < 0
  ) {
    return withCors(request, env, json({ error: "invalid_activity_history_request" }, 400));
  }

  if (
    membershipType !== membership.membershipType ||
    membershipId !== membership.membershipId
  ) {
    return withCors(request, env, json({ error: "membership_mismatch" }, 403));
  }

  const bungieUrl = new URL(
    `${BUNGIE_PLATFORM}/Destiny2/${membership.membershipType}/Account/${encodeURIComponent(membership.membershipId)}/Character/${encodeURIComponent(characterId)}/Stats/Activities/`
  );
  bungieUrl.searchParams.set("count", String(count));
  bungieUrl.searchParams.set("page", String(page));

  const response = await fetch(bungieUrl, { headers: bungieHeaders(auth.session, env) });
  const payload = await response.json<BungieApiResponse<Record<string, unknown>>>().catch(() => null);
  if (!response.ok || !payload?.Response) {
    console.error("bungie_activity_history_failed", {
      status: response.status,
      errorCode: payload?.ErrorCode,
      errorStatus: payload?.ErrorStatus,
      characterId
    });
    return withCors(request, env, json({
      error: "bungie_activity_history_failed",
      status: response.status,
      errorCode: payload?.ErrorCode ?? null,
      errorStatus: payload?.ErrorStatus ?? null
    }, response.status >= 400 && response.status < 500 ? response.status : 502));
  }

  await putSession(env, auth.sessionId, { ...auth.session, lastUsedAt: Date.now() });
  return withCors(request, env, json(payload as Record<string, unknown>));
}

async function pgcrRoute(request: Request, env: Env, instanceId: string): Promise<Response> {
  const auth = await authenticatedSession(request, env);
  if (auth instanceof Response) return auth;

  if (!/^\d+$/.test(instanceId)) {
    return withCors(request, env, json({ error: "invalid_activity_instance_id" }, 400));
  }

  const bungieUrl = `${BUNGIE_PLATFORM}/Destiny2/Stats/PostGameCarnageReport/${encodeURIComponent(instanceId)}/`;
  const response = await fetch(bungieUrl, { headers: bungieHeaders(auth.session, env) });
  const payload = await response.json<BungieApiResponse<Record<string, unknown>>>().catch(() => null);
  if (!response.ok || !payload?.Response) {
    console.error("bungie_pgcr_failed", {
      status: response.status,
      errorCode: payload?.ErrorCode,
      errorStatus: payload?.ErrorStatus,
      instanceId
    });
    return withCors(request, env, json({
      error: "bungie_pgcr_failed",
      status: response.status,
      errorCode: payload?.ErrorCode ?? null,
      errorStatus: payload?.ErrorStatus ?? null
    }, response.status >= 400 && response.status < 500 ? response.status : 502));
  }

  await putSession(env, auth.sessionId, { ...auth.session, lastUsedAt: Date.now() });
  return withCors(request, env, json(payload as Record<string, unknown>));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") return handlePreflight(request, env);
      if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/v1/health")) {
        return json({ service: "astrix-destiny-backend", status: "ready" });
      }
      if (request.method === "GET" && url.pathname === "/diagnostics/runtime-bindings") {
        return json({
          BUNGIE_API_KEY: bindingInfo(env.BUNGIE_API_KEY),
          BUNGIE_CLIENT_ID: bindingInfo(env.BUNGIE_CLIENT_ID),
          BUNGIE_CLIENT_SECRET: bindingInfo(env.BUNGIE_CLIENT_SECRET),
          OAUTH_REDIRECT_URI: bindingInfo(env.OAUTH_REDIRECT_URI)
        }, 200, { "Cache-Control": "no-store" });
      }
      if (request.method === "GET" && url.pathname === "/bungie/start") return startOAuth(request, env);
      if (request.method === "GET" && url.pathname === "/bungie/callback") return oauthCallback(request, env);
      if (request.method === "GET" && url.pathname === "/session") return sessionRoute(request, env);
      if (request.method === "GET" && url.pathname === "/bungie/manifest") return manifestMetadataRoute(request, env);
      if (request.method === "GET" && url.pathname === "/bungie/manifest/component") return manifestComponentRoute(request, env);
      if (request.method === "GET" && url.pathname === "/bungie/manifest/definition") return manifestDefinitionRoute(request, env);
      if (request.method === "GET" && (url.pathname === "/bungie/profile" || url.pathname === "/v1/destiny/profile")) {
        return profileRoute(request, env);
      }
      if (request.method === "GET" && (url.pathname === "/bungie/loadout" || url.pathname === "/v1/destiny/loadout")) {
        return loadoutRoute(request, env);
      }
      if (request.method === "GET" && url.pathname === "/bungie/activity-history") {
        return activityHistoryRoute(request, env);
      }
      if (request.method === "GET" && url.pathname.startsWith("/bungie/pgcr/")) {
        return pgcrRoute(request, env, decodeURIComponent(url.pathname.slice("/bungie/pgcr/".length)));
      }
      if (request.method === "POST" && url.pathname === "/logout") return logoutRoute(request, env);
      return withCors(request, env, json({ error: "not_found" }, 404));
    } catch (error) {
      console.error("worker_request_failed", {
        path: url.pathname,
        message: error instanceof Error ? error.message : String(error)
      });
      return withCors(request, env, json({
        error: "server_error",
        path: url.pathname
      }, 500));
    }
  }
} satisfies ExportedHandler<Env>;
