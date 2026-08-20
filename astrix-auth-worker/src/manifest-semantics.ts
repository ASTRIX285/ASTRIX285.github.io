const BUNGIE_PLATFORM = "https://www.bungie.net/Platform";

async function manifestDefinition(
  definitionType: string,
  hash: number,
  env: Env
): Promise<Record<string, any> | null> {
  if (!Number.isInteger(hash)) return null;
  let cache: Cache | null = null;
  const cacheKey = new Request(`https://auth.astrixparadox.com/.cache/${definitionType}/${hash}`, { method: "GET" });
  try {
    cache = await caches.open("astrix-bungie-definitions");
    const cached = await cache.match(cacheKey);
    if (cached) return cached.json<Record<string, any>>().catch(() => null);
  } catch {}

  const response = await fetch(`${BUNGIE_PLATFORM}/Destiny2/Manifest/${definitionType}/${hash}/`, {
    headers: {
      "X-API-Key": env.BUNGIE_API_KEY,
      "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
    }
  });
  if (!response.ok) return null;
  const payload = await response.json<{ Response?: Record<string, any> }>().catch(() => null);
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

function equipableSetHash(itemDefinition: Record<string, any>): number | null {
  const value = itemDefinition?.equipableItemSetHash ?? itemDefinition?.equippingBlock?.equipableItemSetHash;
  const hash = Number(value);
  return Number.isInteger(hash) && hash > 0 ? hash : null;
}

async function enrichEquipableSets(payload: any, env: Env): Promise<any> {
  const inventory = payload?.definitions || {};
  const setHashes = [...new Set(
    Object.values(inventory)
      .map((definition: any) => equipableSetHash(definition))
      .filter((hash): hash is number => Number.isInteger(hash))
  )];
  if (!setHashes.length) {
    payload.equipableItemSets = payload.equipableItemSets || {};
    payload.sandboxPerks = payload.sandboxPerks || {};
    return payload;
  }

  const sets: Record<string, Record<string, any>> = { ...(payload.equipableItemSets || {}) };
  const setRows = await Promise.all(setHashes.map(async hash => [
    hash,
    sets[String(hash)] || await manifestDefinition("DestinyEquipableItemSetDefinition", hash, env)
  ] as const));
  for (const [hash, definition] of setRows) if (definition) sets[String(hash)] = definition;

  const perkHashes = [...new Set(
    Object.values(sets).flatMap((set: any) => (set?.setPerks || [])
      .map((perk: any) => Number(perk?.sandboxPerkHash))
      .filter(Number.isInteger))
  )];
  const sandboxPerks: Record<string, Record<string, any>> = { ...(payload.sandboxPerks || {}) };
  const perkRows = await Promise.all(perkHashes.map(async hash => [
    hash,
    sandboxPerks[String(hash)] || await manifestDefinition("DestinySandboxPerkDefinition", hash, env)
  ] as const));
  for (const [hash, definition] of perkRows) if (definition) sandboxPerks[String(hash)] = definition;

  payload.equipableItemSets = sets;
  payload.sandboxPerks = sandboxPerks;
  payload.armourSetCoverage = {
    requested: setHashes,
    resolved: setHashes.filter(hash => Boolean(sets[String(hash)])),
    unresolved: setHashes.filter(hash => !sets[String(hash)]),
    perkRequested: perkHashes,
    perkResolved: perkHashes.filter(hash => Boolean(sandboxPerks[String(hash)])),
    perkUnresolved: perkHashes.filter(hash => !sandboxPerks[String(hash)]),
    complete: setHashes.every(hash => Boolean(sets[String(hash)])) && perkHashes.every(hash => Boolean(sandboxPerks[String(hash)]))
  };
  return payload;
}

export { manifestDefinition, equipableSetHash, enrichEquipableSets };
