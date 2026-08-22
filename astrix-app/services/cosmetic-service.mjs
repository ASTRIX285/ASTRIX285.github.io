/**
 * Guardian Build Forge Cosmetic Service
 *
 * Reads and indexes the generated cosmetic-information.json catalogue.
 * Player ownership remains a separate OAuth-backed overlay.
 */

export const COSMETIC_SERVICE_VERSION = '2.0.0';
export const DEFAULT_COSMETIC_CATALOGUE_URL = './data/cosmetic-information.json';

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replaceAll('’', "'").replace(/\s+/g, ' ');
}

function hashKey(value) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function groupedAdd(map, key, value) {
  const normalized = normalize(key);
  if (!normalized) return;
  if (!map.has(normalized)) map.set(normalized, []);
  map.get(normalized).push(value);
}

export class CosmeticService {
  constructor(options = {}) {
    this.catalogueUrl = options.catalogueUrl ?? DEFAULT_COSMETIC_CATALOGUE_URL;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.catalogue = null;
    this.loaded = false;
    this.loadingPromise = null;
    this.byHash = new Map();
    this.byCollectibleHash = new Map();
    this.byId = new Map();
    this.byName = new Map();
    this.byType = new Map();
    this.byCompatibleItemHash = new Map();
  }

  async load(options = {}) {
    const { url = this.catalogueUrl, forceReload = false } = options;
    if (!forceReload && this.loaded) return this.catalogue;
    if (!forceReload && this.loadingPromise) return this.loadingPromise;
    if (typeof this.fetchImplementation !== 'function') {
      throw new Error('CosmeticService requires a fetch implementation.');
    }
    this.loadingPromise = this.fetchImplementation(url, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(`Unable to load cosmetic catalogue: ${response.status}`);
        return response.json();
      })
      .then(catalogue => this.setCatalogue(catalogue))
      .finally(() => { this.loadingPromise = null; });
    return this.loadingPromise;
  }

  setCatalogue(catalogue) {
    if (!catalogue || !Array.isArray(catalogue.cosmetics)) {
      throw new Error('Cosmetic catalogue must contain a cosmetics array.');
    }
    this.catalogue = catalogue;
    this.buildIndexes();
    this.loaded = true;
    return catalogue;
  }

  buildIndexes() {
    this.byHash.clear();
    this.byCollectibleHash.clear();
    this.byId.clear();
    this.byName.clear();
    this.byType.clear();
    this.byCompatibleItemHash.clear();

    for (const cosmetic of this.catalogue.cosmetics) {
      const hash = hashKey(cosmetic.bungieHash);
      if (hash) this.byHash.set(hash, cosmetic);
      if (cosmetic.id) this.byId.set(cosmetic.id, cosmetic);
      groupedAdd(this.byName, cosmetic.name, cosmetic);
      groupedAdd(this.byType, cosmetic.cosmeticType, cosmetic);

      const collectible = hashKey(cosmetic.collectibleHash);
      if (collectible) this.byCollectibleHash.set(collectible, cosmetic);

      for (const itemHash of cosmetic.compatibleItemHashes ?? []) {
        const key = hashKey(itemHash);
        if (!this.byCompatibleItemHash.has(key)) this.byCompatibleItemHash.set(key, []);
        this.byCompatibleItemHash.get(key).push(cosmetic);
      }
    }
  }

  getByHash(hash) { return this.byHash.get(hashKey(hash)) ?? null; }
  getByCollectibleHash(hash) { return this.byCollectibleHash.get(hashKey(hash)) ?? null; }
  getById(id) { return this.byId.get(String(id)) ?? null; }
  findByName(name) { return [...(this.byName.get(normalize(name)) ?? [])]; }
  listByType(type) { return [...(this.byType.get(normalize(type)) ?? [])]; }
  listForItem(itemHash) { return [...(this.byCompatibleItemHash.get(hashKey(itemHash)) ?? [])]; }

  withOwnership(cosmetic, ownership = {}) {
    const items = new Set([...(ownership.itemHashes ?? [])].map(String));
    const collectibles = new Set([...(ownership.collectibleHashes ?? [])].map(String));
    const equipped = new Set([...(ownership.equippedItemHashes ?? [])].map(String));

    return {
      ...cosmetic,
      playerState: {
        owned:
          items.has(String(cosmetic.bungieHash)) ||
          (cosmetic.collectibleHash !== null && collectibles.has(String(cosmetic.collectibleHash))),
        equipped: equipped.has(String(cosmetic.bungieHash))
      }
    };
  }
}

export function createCosmeticService(options = {}) {
  return new CosmeticService(options);
}
