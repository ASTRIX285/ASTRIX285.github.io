/**
 * ASTRIX PARADOX - GAME COMPONENT SERVICE
 * Read-only manifest-backed game component resolver for abilities, aspects,
 * fragments, and seasonal artifacts.
 */

export const GAME_COMPONENT_SERVICE_VERSION = '1.1.0';
export const DEFAULT_GAME_COMPONENTS_URL = '../../data/game-components.json';

function normalise(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(/\s+/g, ' ');
}

function add(index, key, value) {
  const normalised = normalise(key);
  if (!normalised) return;
  if (!index.has(normalised)) index.set(normalised, []);
  index.get(normalised).push(value);
}

export class GameComponentService {
  constructor(options = {}) {
    this.url = options.url ?? DEFAULT_GAME_COMPONENTS_URL;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.catalogue = null;
    this.loaded = false;
    this.byHash = new Map();
    this.byId = new Map();
    this.byName = new Map();
    this.byType = new Map();
    this.byClass = new Map();
    this.bySubclass = new Map();
  }

  async load(options = {}) {
    const url = options.url ?? this.url;
    if (this.loaded && !options.forceReload) return this.catalogue;
    if (typeof this.fetchImplementation !== 'function') {
      throw new Error('GameComponentService requires fetch.');
    }
    const response = await this.fetchImplementation(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load game components: ${response.status}`);
    }
    return this.setCatalogue(await response.json());
  }

  setCatalogue(catalogue) {
    if (!catalogue || !Array.isArray(catalogue.components) || !Array.isArray(catalogue.artifacts)) {
      throw new Error('Invalid game-component catalogue.');
    }
    this.catalogue = catalogue;
    this.buildIndexes();
    this.loaded = true;
    return catalogue;
  }

  buildIndexes() {
    for (const index of [
      this.byHash,
      this.byId,
      this.byName,
      this.byType,
      this.byClass,
      this.bySubclass
    ]) {
      index.clear();
    }

    for (const component of this.catalogue.components) {
      this.byHash.set(String(component.bungieHash), component);
      if (component.id) this.byId.set(component.id, component);
      add(this.byName, component.name, component);
      add(this.byType, component.componentType, component);
      add(this.byClass, component.class, component);
      add(this.bySubclass, component.subclass ?? 'Unknown', component);
    }
  }

  ensureLoaded() {
    if (!this.loaded || !this.catalogue) {
      throw new Error('Game-component catalogue has not been loaded.');
    }
  }

  getByHash(hash) {
    this.ensureLoaded();
    return this.byHash.get(String(hash)) ?? null;
  }

  getById(id) {
    this.ensureLoaded();
    return this.byId.get(String(id)) ?? null;
  }

  getByName(name) {
    this.ensureLoaded();
    return [...(this.byName.get(normalise(name)) ?? [])];
  }

  getByType(type) {
    this.ensureLoaded();
    return [...(this.byType.get(normalise(type)) ?? [])];
  }

  getByClass(className) {
    this.ensureLoaded();
    return [...(this.byClass.get(normalise(className)) ?? [])];
  }

  getBySubclass(subclass) {
    this.ensureLoaded();
    return [...(this.bySubclass.get(normalise(subclass)) ?? [])];
  }

  getArtifacts() {
    this.ensureLoaded();
    return [...this.catalogue.artifacts];
  }

  search(query, filters = {}) {
    this.ensureLoaded();
    const needle = normalise(query);
    return this.catalogue.components.filter((component) => {
      if (filters.componentType && normalise(component.componentType) !== normalise(filters.componentType)) return false;
      if (filters.class && normalise(component.class) !== normalise(filters.class)) return false;
      if (filters.subclass && normalise(component.subclass) !== normalise(filters.subclass)) return false;
      if (typeof filters.verified === 'boolean' && component.verified !== filters.verified) return false;
      if (!needle) return true;

      const text = [
        component.name,
        component.componentType,
        component.class,
        component.subclass,
        component.officialDescription,
        ...(component.curated?.effects ?? []),
        ...(component.curated?.inputs ?? []),
        ...(component.curated?.outputs ?? [])
      ]
        .map(normalise)
        .join(' ');

      return text.includes(needle);
    });
  }
}

export const gameComponentService = new GameComponentService();
export const createGameComponentService = (options = {}) => new GameComponentService(options);