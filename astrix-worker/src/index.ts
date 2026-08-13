import { AuthRecord } from "./auth-record";

export { AuthRecord };

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/v1/health")) {
      return Response.json({
        service: "astrix-destiny-backend",
        status: "ready-for-oauth-wiring"
      }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    return Response.json({
      error: "not_implemented",
      message: "ASTRIX backend route is not implemented yet."
    }, {
      status: 501,
      headers: { "Cache-Control": "no-store" }
    });
  }
} satisfies ExportedHandler;
