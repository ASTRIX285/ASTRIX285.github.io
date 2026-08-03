/** Read-only armour catalogue service for Paradox Forge. */

export const ARMOR_SERVICE_VERSION = '1.0.0';
export const DEFAULT_ARMOR_CATALOGUE_URL = './data/armor-information.json';

const normalize = (value) => String(value ?? '').trim().toLowerCase().replaceAll('’', "'").replace(/\s+/g, ' ');
const group = (index, key, item) => {
  const normalized = normalize(key);
  if (!normalized) return;
  if (!index.has(normalized)) index.set(normalized, []);
  index.get(normalized).push(item);
};

export class ArmorService {
  constructor(options = {}) {
    this.catalogueUrl = options.catalogueUrl ?? DEFAULT_ARMOR_CATALOGUE_URL;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.loaded = false;
    this.catalogue = null;
    this.byHash = new Map();
    this.byId = new Map();
    this.byName = new Map();
    this.byClass = new Map();
    this.bySlot = new Map();
    this.byRarity = new Map();
    this.bySetName = new Map();
  }

  async load(options = {}) {
    const url = options.url ?? this.catalogueUrl;
    if (this.loaded && !options.forceReload) return this.catalogue;
    if (typeof this.fetchImplementation !== 'function') throw new Error('ArmorService requires fetch.');
    const response = await this.fetchImplementation(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load armour catalogue: ${response.status}`);
    this.setCatalogue(await response.json());
    return this.catalogue;
  }

  setCatalogue(catalogue) {
    if (!catalogue || !Array.isArray(catalogue.armor)) throw new Error('Armour catalogue must contain an armor array.');
    this.catalogue = catalogue;
    this.buildIndexes();
    this.loaded = true;
    return catalogue;
  }

  buildIndexes() {
    for (const index of [this.byHash, this.byId, this.byName, this.byClass, this.bySlot, this.byRarity, this.bySetName]) index.clear();
    for (const item of this.catalogue.armor) {
      this.byHash.set(String(item.bungieHash), item);
      this.byId.set(item.id, item);
      group(this.byName, item.name, item);
      group(this.byClass, item.className, item);
      group(this.bySlot, item.armorSlot, item);
      group(this.byRarity, item.rarity, item);
      group(this.bySetName, item.curated?.setName, item);
    }
  }

  ensureLoaded() {
    if (!this.loaded || !this.catalogue) throw new Error('Armour catalogue has not been loaded.');
  }

  getAllArmor() { this.ensureLoaded(); return [...this.catalogue.armor]; }
  getByHash(hash) { this.ensureLoaded(); return this.byHash.get(String(hash)) ?? null; }
  getById(id) { this.ensureLoaded(); return this.byId.get(String(id)) ?? null; }
  getByName(name) { this.ensureLoaded(); return [...(this.byName.get(normalize(name)) ?? [])]; }
  getByClass(className) { this.ensureLoaded(); return [...(this.byClass.get(normalize(className)) ?? [])]; }
  getBySlot(slot) { this.ensureLoaded(); return [...(this.bySlot.get(normalize(slot)) ?? [])]; }
  getByRarity(rarity) { this.ensureLoaded(); return [...(this.byRarity.get(normalize(rarity)) ?? [])]; }
  getBySetName(setName) { this.ensureLoaded(); return [...(this.bySetName.get(normalize(setName)) ?? [])]; }

  search(query, filters = {}) {
    this.ensureLoaded();
    const q = normalize(query);
    return this.catalogue.armor.filter((item) => {
      if (filters.className && normalize(item.className) !== normalize(filters.className)) return false;
      if (filters.slot && normalize(item.armorSlot) !== normalize(filters.slot)) return false;
      if (filters.rarity && normalize(item.rarity) !== normalize(filters.rarity)) return false;
      if (typeof filters.verified === 'boolean' && item.verified !== filters.verified) return false;
      if (!q) return true;
      const stats = (item.official?.investmentStats ?? []).map((stat) => `${stat.name ?? ''} ${stat.value}`).join(' ');
      const haystack = normalize([item.name, item.armorSlot, item.className, item.rarity, item.officialDescription, item.curated?.setName, item.curated?.usageNotes, ...(item.curated?.setTags ?? []), stats].join(' '));
      return haystack.includes(q);
    });
  }

  getDefinitionStats(hash) {
    const item = this.getByHash(hash);
    return item ? [...(item.official?.investmentStats ?? [])] : [];
  }
}

export const armorService = new ArmorService();
export const createArmorService = (options = {}) => new ArmorService(options);
