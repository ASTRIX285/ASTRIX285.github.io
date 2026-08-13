import { handleAuthRoute } from "./routes-auth";
import { handleApiRoute } from "./routes-api";
import { AuthRecord } from "./auth-record";
import { handlePreflight, json, isLocalHost } from "./web";

const AUTH_HOST = "auth.astrixparadox.com";
const API_HOST = "api.astrixparadox.com";

export { AuthRecord };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handlePreflight(request, env);
    }

    try {
      if (url.hostname === AUTH_HOST || isLocalHost(url.hostname)) {
        const auth = await handleAuthRoute(request, url, env);
        if (auth) return auth;

        const api = await handleApiRoute(request, url, env, true);
        if (api) return api;
      }

      if (url.hostname === API_HOST) {
        const api = await handleApiRoute(request, url, env, false);
        if (api) return api;
      }

      return json({
        error: "not_found",
        message: "No ASTRIX backend route matches this request."
      }, 404);
    } catch (error) {
      console.error(JSON.stringify({
        event: "request_failed",
        path: url.pathname,
        message: error instanceof Error ? error.message : "unknown_error"
      }));

      return json({
        error: "server_error",
        message: "ASTRIX backend request failed."
      }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
