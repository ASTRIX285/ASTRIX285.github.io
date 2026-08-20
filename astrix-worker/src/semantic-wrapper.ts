import worker, { AuthRecord } from "./index";
export { AuthRecord };

const BUNGIE_PLATFORM = "https://www.bungie.net/Platform";
const SUBCLASS_BUCKET_HASH = 3284755031;

function definitionCategory(definition: Record<string, any> | undefined): string {
  return String(definition?.plug?.plugCategoryIdentifier || "").toLowerCase();
}

function isSuperDefinition(definition: Record<string, any> | undefined): boolean {
  const category = definitionCategory(definition);
  return category === "super" || category === "supers" || category.includes("super");
}

async function fetchDefinition(hash: number, env: Env): Promise<Record<string, unknown> | null> {
  let cache: Cache | null = null;
  const cacheKey = new Request(`https://auth.astrixparadox.com/.cache/inventory/${hash}`, { method: "GET" });
  try {
    cache = await caches.open("astrix-bungie-definitions");
    const cached = await cache.match(cacheKey);
    if (cached) return cached.json<Record<string, unknown>>().catch(() => null);
  } catch {}

  const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`, {
    headers: {
      "X-API-Key": env.BUNGIE_API_KEY,
      "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
    }
  });
  if (!response.ok) return null;
  const payload = await response.json<{ Response?: Record<string, unknown> }>().catch(() => null);
  const definition = payload?.Response || null;
  if (definition && cache) {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(definition), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=604800" }
      }));
    } catch {}
  }
  return definition;
}

async function enrichLoadoutResponse(response: Response, env: Env): Promise<Response> {
  if (!response.ok) return response;
  const payload = await response.clone().json<any>().catch(() => null);
  if (!payload?.profile || !Array.isArray(payload?.selectedItems)) return response;

  const definitions: Record<string, Record<string, any>> = { ...(payload.definitions || {}) };
  const subclass = payload.selectedItems.find((item: any) => {
    const definition = definitions[String(item?.itemHash)];
    return Number(definition?.inventory?.bucketTypeHash) === SUBCLASS_BUCKET_HASH;
  });
  if (!subclass?.itemInstanceId) return response;

  const selectedHashes = Array.isArray(subclass.plugItemHashes) ? subclass.plugItemHashes.map(Number) : [];
  let superSocketIndex = selectedHashes.findIndex((hash: number) => isSuperDefinition(definitions[String(hash)]));

  if (superSocketIndex < 0) {
    const currentSockets = payload.profile?.itemComponents?.sockets?.data?.[subclass.itemInstanceId]?.sockets || [];
    superSocketIndex = currentSockets.findIndex((socket: any) => isSuperDefinition(definitions[String(socket?.plugHash)]));
  }
  if (superSocketIndex < 0) return response;

  const candidateHashes = new Set<number>();
  const equippedHash = selectedHashes[superSocketIndex];
  if (Number.isInteger(equippedHash)) candidateHashes.add(equippedHash);

  const reusable = payload.profile?.itemComponents?.reusablePlugs?.data?.[subclass.itemInstanceId]?.plugs || {};
  for (const row of reusable[String(superSocketIndex)] || reusable[superSocketIndex] || []) {
    const hash = Number(row?.plugItemHash ?? row?.plugHash);
    if (Number.isInteger(hash)) candidateHashes.add(hash);
  }

  const subclassDefinition = definitions[String(subclass.itemHash)] || {};
  const manifestSocket = subclassDefinition?.sockets?.socketEntries?.[superSocketIndex];
  const initialHash = Number(manifestSocket?.singleInitialItemHash);
  if (Number.isInteger(initialHash)) candidateHashes.add(initialHash);
  for (const row of manifestSocket?.reusablePlugItems || []) {
    const hash = Number(row?.plugItemHash);
    if (Number.isInteger(hash)) candidateHashes.add(hash);
  }

  const missing = [...candidateHashes].filter(hash => !definitions[String(hash)]);
  const resolved = await Promise.all(missing.map(async hash => [hash, await fetchDefinition(hash, env)] as const));
  for (const [hash, definition] of resolved) if (definition) definitions[String(hash)] = definition as Record<string, any>;

  const superHashes = [...candidateHashes].filter(hash => isSuperDefinition(definitions[String(hash)]));
  payload.definitions = definitions;
  payload.definitionCoverage = payload.definitionCoverage || {};
  payload.definitionCoverage.requested = Number(payload.definitionCoverage.requested || 0) + missing.length;
  payload.definitionCoverage.resolved = Number(payload.definitionCoverage.resolved || 0) + resolved.filter(([, definition]) => Boolean(definition)).length;
  const existingUnresolved = Array.isArray(payload.definitionCoverage.unresolved) ? payload.definitionCoverage.unresolved.map(Number) : [];
  payload.definitionCoverage.unresolved = [...new Set([
    ...existingUnresolved,
    ...missing.filter(hash => !definitions[String(hash)])
  ])];
  payload.definitionCoverage.complete = payload.definitionCoverage.unresolved.length === 0;
  payload.loadoutSuperCoverage = {
    subclassItemHash: Number(subclass.itemHash),
    subclassInstanceId: String(subclass.itemInstanceId),
    superSocketIndex,
    requested: [...candidateHashes],
    resolved: superHashes,
    unresolved: [...candidateHashes].filter(hash => !definitions[String(hash)]),
    complete: [...candidateHashes].every(hash => Boolean(definitions[String(hash)]))
  };

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await worker.fetch(request, env, ctx);
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && (path === "/bungie/loadout" || path === "/v1/destiny/loadout")) {
      try { return await enrichLoadoutResponse(response, env); }
      catch (error) {
        console.error("loadout_semantic_enrichment_failed", { message: error instanceof Error ? error.message : String(error) });
        return response;
      }
    }
    return response;
  }
} satisfies ExportedHandler<Env>;
