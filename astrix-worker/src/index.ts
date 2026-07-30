interface Env {
  ENVIRONMENT: string;
  APP_ORIGIN: string;
  // OAuth gate TODO: declare BUNGIE_CLIENT_SECRET only after Miguel provisions
  // the Worker secret and confirms all six OAuth-gate conditions.
}

type JsonRecord = Record<string, unknown>;

const AUTH_HOST = "auth.astrixparadox.com";
const API_HOST = "api.astrixparadox.com";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handlePreflight(request, env);
    }

    if (url.hostname === AUTH_HOST || isLocalHost(url.hostname)) {
      const authResponse = routeAuth(request, url, env);
      if (authResponse) return authResponse;
    }

    if (url.hostname === API_HOST || isLocalHost(url.hostname)) {
      const apiResponse = routeApi(request, url, env);
      if (apiResponse) return apiResponse;
    }

    return json(
      {
        error: "not_found",
        message: "No ASTRIX backend route matches this request."
      },
      404
    );
  }
};

function routeAuth(request: Request, url: URL, env: Env): Response | null {
  if (request.method === "GET" && url.pathname === "/health") {
    return json({
      service: "astrix-destiny-backend",
      surface: "auth",
      status: "scaffold",
      environment: env.ENVIRONMENT,
      oauthGate: "closed"
    });
  }

  if (request.method === "GET" && url.pathname === "/bungie/start") {
    return oauthGate("Start Bungie authorization flow");
  }

  if (request.method === "GET" && url.pathname === "/bungie/callback") {
    return oauthGate("Validate callback and exchange authorization code server-side");
  }

  if (request.method === "GET" && url.pathname === "/session") {
    return oauthGate("Read the ASTRIX server-side session");
  }

  if (request.method === "POST" && url.pathname === "/logout") {
    return oauthGate("Revoke the ASTRIX session and expire its cookie");
  }

  return null;
}

function routeApi(request: Request, url: URL, env: Env): Response | null {
  if (request.method === "GET" && url.pathname === "/v1/health") {
    return withCors(
      request,
      env,
      json({
        service: "astrix-destiny-backend",
        surface: "api",
        status: "scaffold",
        environment: env.ENVIRONMENT,
        oauthGate: "closed"
      })
    );
  }

  if (request.method === "GET" && url.pathname === "/v1/me") {
    return withCors(request, env, oauthGate("Return minimal authenticated ASTRIX profile"));
  }

  if (request.method === "GET" && url.pathname === "/v1/destiny/profile") {
    return withCors(request, env, oauthGate("Read private Destiny profile data"));
  }

  if (request.method === "GET" && url.pathname === "/v1/destiny/inventory") {
    return withCors(request, env, oauthGate("Read Destiny inventory and vault data"));
  }

  return null;
}

function oauthGate(futurePurpose: string): Response {
  return json(
    {
      error: "oauth_gate_closed",
      message: "This route is scaffolded but deliberately not implemented.",
      futurePurpose,
      blockedUntil: [
        "Worker provisioned",
        "api and auth domains verified",
        "exact Bungie redirect URI registered",
        "encrypted Worker secret storage configured",
        "session and token datastore selected",
        "CORS, cookie, CSRF and logout design approved"
      ]
    },
    501,
    { "Cache-Control": "no-store" }
  );
}

function handlePreflight(request: Request, env: Env): Response {
  const origin = request.headers.get("Origin");
  if (origin !== env.APP_ORIGIN) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin"
    }
  });
}

function withCors(request: Request, env: Env, response: Response): Response {
  const origin = request.headers.get("Origin");
  if (!origin) return response;
  if (origin !== env.APP_ORIGIN) {
    return json({ error: "origin_not_allowed" }, 403);
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function json(body: JsonRecord, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".workers.dev");
}
