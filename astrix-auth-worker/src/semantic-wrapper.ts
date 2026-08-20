import worker, { AuthRecord } from "./index";
import { manifestDefinition, enrichEquipableSets } from "./manifest-semantics";
export { AuthRecord };

const SUBCLASS_BUCKET_HASH = 3284755031;
const WEAPON_BUCKETS = new Set([1498876634, 2465295065, 953998645]);

function definitionCategory(definition: Record<string, any> | undefined): string {
  return String(definition?.plug?.plugCategoryIdentifier || "").toLowerCase();
}

function isSuperDefinition(definition: Record<string, any> | undefined): boolean {
  const category = definitionCategory(definition);
  return category === "super" || category === "supers" || category.includes("super");
}

async function resolveMissingInventoryDefinitions(payload: any, hashes: Iterable<number>, env: Env): Promise<number[]> {
  const definitions: Record<string, Record<string, any>> = payload.definitions || (payload.definitions = {});
  const unique = [...new Set([...hashes].map(Number).filter(Number.isInteger))];
  const missing = unique.filter(hash => !definitions[String(hash)]);
  const rows = await Promise.all(missing.map(async hash => [
    hash,
    await manifestDefinition("DestinyInventoryItemDefinition", hash, env)
  ] as const));
  for (const [hash, definition] of rows) if (definition) definitions[String(hash)] = definition;
  return missing.filter(hash => !definitions[String(hash)]);
}

function equippedRows(payload: any): any[] {
  return Object.values(payload?.profile?.characterEquipment?.data || {}).flatMap((row: any) => row?.items || []);
}

async function enrichWeaponReusablePlugs(payload: any, env: Env): Promise<any> {
  const profile = payload?.profile;
  if (!profile) return payload;
  const definitions: Record<string, Record<string, any>> = payload.definitions || (payload.definitions = {});
  const reusableData = profile?.itemComponents?.reusablePlugs?.data || {};
  const weaponRows = equippedRows(payload).filter((item: any) => {
    const definition = definitions[String(item?.itemHash)];
    return WEAPON_BUCKETS.has(Number(definition?.inventory?.bucketTypeHash));
  });
  const requested = new Set<number>();
  const byInstance: Record<string, Record<string, number[]>> = {};
  for (const item of weaponRows) {
    if (!item?.itemInstanceId) continue;
    const plugs = reusableData[item.itemInstanceId]?.plugs || {};
    const socketMap: Record<string, number[]> = {};
    for (const [socketIndex, rows] of Object.entries(plugs)) {
      const hashes = (rows as any[]).map(row => Number(row?.plugItemHash ?? row?.plugHash)).filter(Number.isInteger);
      if (!hashes.length) continue;
      socketMap[String(socketIndex)] = [...new Set(hashes)];
      hashes.forEach(hash => requested.add(hash));
    }
    byInstance[String(item.itemInstanceId)] = socketMap;
  }
  const unresolved = await resolveMissingInventoryDefinitions(payload, requested, env);
  payload.weaponReusablePlugs = byInstance;
  payload.weaponReusableCoverage = {
    requested: [...requested],
    resolved: [...requested].filter(hash => Boolean(definitions[String(hash)])),
    unresolved,
    complete: unresolved.length === 0
  };
  return payload;
}

async function enrichLoadoutSupers(payload: any, env: Env): Promise<any> {
  if (!payload?.profile || !Array.isArray(payload?.selectedItems)) return payload;
  const definitions: Record<string, Record<string, any>> = payload.definitions || (payload.definitions = {});
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

  const unresolved = await resolveMissingInventoryDefinitions(payload, candidateHashes, env);
  payload.loadoutSuperCoverage = {
    subclassItemHash: Number(subclass.itemHash),
    subclassInstanceId: String(subclass.itemInstanceId),
    superSocketIndex,
    requested: [...candidateHashes],
    resolved: [...candidateHashes].filter(hash => isSuperDefinition(definitions[String(hash)])),
    unresolved,
    complete: unresolved.length === 0
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
        return await rewriteJsonResponse(response, async payload => {
          await enrichEquipableSets(payload, env);
          await enrichWeaponReusablePlugs(payload, env);
          return payload;
        });
      }
      if (request.method === "GET" && (path === "/bungie/loadout" || path === "/v1/destiny/loadout")) {
        return await rewriteJsonResponse(response, async payload => {
          await enrichLoadoutSupers(payload, env);
          await enrichEquipableSets(payload, env);
          await enrichWeaponReusablePlugs(payload, env);
          return payload;
        });
      }
    } catch (error) {
      console.error("semantic_enrichment_failed", { path, message: error instanceof Error ? error.message : String(error) });
    }
    return response;
  }
} satisfies ExportedHandler<Env>;
