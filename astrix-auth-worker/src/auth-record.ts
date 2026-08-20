import { DurableObject } from "cloudflare:workers";

export type Membership = { membershipType: number; membershipId: string; displayName?: string };
export type OAuthTransaction = { kind: "oauth-transaction"; state: string; createdAt: number; returnUrl: string; used: boolean };
export type SessionRecord = { kind: "session"; createdAt: number; lastUsedAt: number; absoluteExpiresAt: number; accessToken: string; refreshToken: string; accessExpiresAt: number; refreshExpiresAt: number | null; bungieMembershipId: string | null; destinyMemberships: Membership[]; primaryMembershipId: string | null; activeDestinyMembership: Membership | null; csrfToken: string };
export type AuthRecordValue = OAuthTransaction | SessionRecord;

export class AuthRecord extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method === "PUT" && path === "/record") {
      await this.ctx.storage.put("record", await request.json<AuthRecordValue>());
      return new Response(null, { status: 204 });
    }
    if (request.method === "GET" && path === "/record") {
      const record = await this.ctx.storage.get<AuthRecordValue>("record");
      return record ? Response.json(record, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: 404 });
    }
    if (request.method === "POST" && path === "/take-oauth") {
      const record = await this.ctx.storage.get<AuthRecordValue>("record");
      if (!record || record.kind !== "oauth-transaction" || record.used) return new Response(null, { status: 404 });
      const used: OAuthTransaction = { ...record, used: true };
      await this.ctx.storage.put("record", used);
      return Response.json(used, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method === "DELETE" && path === "/record") {
      await this.ctx.storage.deleteAll();
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 404 });
  }
}
