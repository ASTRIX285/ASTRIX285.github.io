// Display data only. Apply never enters this cache; it reads Bungie directly.
export const DISPLAY_TTL_MS = 15_000;
const MAX_BYTES = 4 * 1024 * 1024;
const CHUNK_CHARS = 16_000;
type Storage = Pick<DurableObjectStorage, "get" | "put" | "delete">;
type Snapshot = { body: string; fetchedAt: number; source: "bungie" | "snapshot" };

export class ProfileSnapshotCache {
  private pending = new Map<string, Promise<Snapshot>>();
  private storage: Storage;
  constructor(storage: Storage) { this.storage = storage; }

  async read(key: string, load: () => Promise<string>, now = Date.now()): Promise<Snapshot> {
    const active = this.pending.get(key);
    if (active) return active;
    const task = this.resolve(key, load, now);
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }

  private async resolve(key: string, load: () => Promise<string>, now: number): Promise<Snapshot> {
    const prefix = `profile:${key}:`;
    const previous = await this.storage.get<{ fetchedAt: number; chunks: number }>(prefix + "meta");
    if (previous && now >= previous.fetchedAt && now - previous.fetchedAt < DISPLAY_TTL_MS) {
      const keys = Array.from({ length: previous.chunks }, (_, i) => prefix + i);
      const values = await this.storage.get<string>(keys);
      if (keys.every(k => typeof values.get(k) === "string")) {
        return { body: keys.map(k => values.get(k)).join(""), fetchedAt: previous.fetchedAt, source: "snapshot" };
      }
    }
    const body = await load(); // Never cache errors or serve expired data after a failed refresh.
    const fetchedAt = Date.now();
    if (new TextEncoder().encode(body).byteLength <= MAX_BYTES) {
      const chunks = Math.ceil(body.length / CHUNK_CHARS);
      // Invalidate the marker first; a failed write cannot expose mixed generations.
      await this.storage.delete(prefix + "meta");
      for (let i = 0; i < chunks; i++) await this.storage.put(prefix + i, body.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS));
      for (let i = chunks; i < (previous?.chunks || 0); i++) await this.storage.delete(prefix + i);
      await this.storage.put(prefix + "meta", { fetchedAt, chunks });
    }
    return { body, fetchedAt, source: "bungie" };
  }
}
