import worker, { AuthRecord } from "./index";
import { manifestDefinition, enrichEquipableSets } from "./manifest-semantics";
export { AuthRecord };

const SUBCLASS_BUCKET_HASH = 3284755031;

function definitionCategory(definition: Record<string, any> | undefined): string {
  return String(definition?.plug?.plugCategoryIdentifier || "").toLowerCase();
}

function isSuperDefinition(definition: Record<string, any> | undefined): boolean {
  const category = definitionCategory(definition);
  return category === "super" || category === "supers" || category.includes("super");
}

async function enrichLoadoutSupers(payload: any, env: Env): Promise<any> {
  if (!payload?.profile || !Array.isArray(payload?.selectedItems)) return payload;
  const definitions: Record<string, Record<string, any>> = { ...(payload.definitions || {}) };
  const subclass = payload.selectedItems.find((item: any) => {
    const definition = definitions[String(item?.itemHash)];
    return Number(definition?.inventory?.bucketTypeHash) === SUBCLASS_BUCKET_HASH;
  });
  if (!subclass?.itemInstanceId) return payload;

  const selectedHashes = Array.isArray(subclass.plugItemHashes) ? subclass.plugItemHashes.map(Number) : [];
  let superSocketIndex = selectedHashes.findIndex((hash: number) => isSuperDefinition(definitions[String(hash)]));
  if (superSocketIndex < 0) {
    const currentSockets = payload.profile?.itemComponents?.sockets?.data?.[subclass.itemInstanceId]?.sockets || [];
    superSocketIndex = currentSockets.findIndex((socket: any) => isSuperDefinition(definitions[String(socket?.plugHash)]));
  }
  if (superSocketIndex < 0) return payload;

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
  const resolved = await Promise.all(missing.map(async hash => [
    hash,
    await manifestDefinition("DestinyInventoryItemDefinition", hash, env)
  ] as const));
  for (const [hash, definition] of resolved) if (definition) definitions[String(hash)] = definition;

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
    resolved: [...candidateHashes].filter(hash => isSuperDefinition(definitions[String(hash)])),
    unresolved: [...candidateHashes].filter(hash => !definitions[String(hash)]),
    complete: [...candidateHashes].every(hash => Boolean(definitions[String(hash)]))
  };
  return payload;
}

async function rewriteJsonResponse(response: Response, transform: (payload: any) => Promise<any>): Promise<Response> {
  if (!response.ok) return response;
  const payload = await response.clone().json<any>().catch(() => null);
  if (!payload) return response;
  const updated = await transform(payload);
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(updated), { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await worker.fetch(request, env);
    const path = new URL(request.url).pathname;
    try {
      if (request.method === "GET" && (path === "/bungie/profile" || path === "/v1/destiny/profile")) {
        return await rewriteJsonResponse(response, payload => enrichEquipableSets(payload, env));
      }
      if (request.method === "GET" && (path === "/bungie/loadout" || path === "/v1/destiny/loadout")) {
        return await rewriteJsonResponse(response, async payload => {
          await enrichLoadoutSupers(payload, env);
          await enrichEquipableSets(payload, env);
          return payload;
        });
      }
    } catch (error) {
      console.error("semantic_enrichment_failed", {
        path,
        message: error instanceof Error ? error.message : String(error)
      });
    }
    return response;
  }
} satisfies ExportedHandler<Env>;
