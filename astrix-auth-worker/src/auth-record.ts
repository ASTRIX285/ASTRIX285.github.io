import { DurableObject } from "cloudflare:workers";
import { ProfileSnapshotCache } from "./profile-snapshot-cache";

export type Membership = { membershipType: number; membershipId: string; displayName?: string };
export type OAuthTransaction = { kind: "oauth-transaction"; state: string; createdAt: number; returnUrl: string; used: boolean };
export type SessionRecord = { kind: "session"; createdAt: number; lastUsedAt: number; absoluteExpiresAt: number; accessToken: string; refreshToken: string; accessExpiresAt: number; refreshExpiresAt: number | null; bungieMembershipId: string | null; destinyMemberships: Membership[]; primaryMembershipId: string | null; activeDestinyMembership: Membership | null; csrfToken: string; verifiedCharacterIds?: string[]; verifiedCharactersAt?: number };
export type AuthRecordValue = OAuthTransaction | SessionRecord;

export class AuthRecord extends DurableObject<Env> {
  private snapshots = new ProfileSnapshotCache(this.ctx.storage);
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    // Internal Durable Object route, never exposed by the public Worker router.
    if (request.method === "POST" && path === "/profile-snapshot") {
      const record = await this.ctx.storage.get<AuthRecordValue>("record");
      if (!record || record.kind !== "session" || record.absoluteExpiresAt <= Date.now() || record.accessExpiresAt <= Date.now() || !record.activeDestinyMembership) return new Response(null, { status: 401 });
      const { components } = await request.json<{ components: number[] }>();
      if (!Array.isArray(components) || components.length > 32 || !components.every(Number.isInteger)) return new Response(null, { status: 400 });
      const membership = record.activeDestinyMembership;
      const key = `${membership.membershipType}:${membership.membershipId}:${[...components].sort((a,b)=>a-b).join(",")}`;
      try {
        const snapshot = await this.snapshots.read(key, async () => {
          const url = new URL(`https://www.bungie.net/Platform/Destiny2/${membership.membershipType}/Profile/${encodeURIComponent(membership.membershipId)}/`);
          url.searchParams.set("components", components.join(","));
          const response = await fetch(url, { headers: { Authorization: `Bearer ${record.accessToken}`, "X-API-Key": this.env.BUNGIE_API_KEY }, signal: AbortSignal.timeout(30_000) });
          const body = await response.text();
          const payload = JSON.parse(body);
          if (!response.ok || !payload?.Response || payload.ErrorCode !== 1) throw new Error("snapshot_upstream_failed");
          return body;
        });
        return new Response(snapshot.body, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Astrix-Profile-Source": snapshot.source, "X-Astrix-Profile-Fetched-At": String(snapshot.fetchedAt) } });
      } catch { return Response.json({ error: "profile_snapshot_unavailable" }, { status: 502 }); }
    }
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
