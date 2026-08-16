/**
 * ASTRIX PARADOX - KNOWLEDGE GRAPH SERVICE
 * Graph evaluation service for build synergy tracking, component interactions,
 * ability-loop traversal, and condition checking.
 */

export const KNOWLEDGE_GRAPH_SERVICE_VERSION = '1.1.0';
export const DEFAULT_RELATIONSHIPS_URL = '../../data/knowledge-relationships.json';

function keyOf(ref) {
  if (!ref || typeof ref !== 'object') return 'unknown:unknown';
  return `${ref.namespace || 'global'}:${ref.id || 'unresolved'}`;
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export class KnowledgeGraphService {
  constructor(options = {}) {
    this.url = options.url ?? DEFAULT_RELATIONSHIPS_URL;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.catalogue = null;
    this.loaded = false;
    this.byId = new Map();
    this.outgoing = new Map();
    this.incoming = new Map();
  }

  async load(options = {}) {
    const url = options.url ?? this.url;
    if (this.loaded && !options.forceReload) return this.catalogue;
    if (typeof this.fetchImplementation !== 'function') {
      throw new Error('KnowledgeGraphService requires fetch.');
    }
    const response = await this.fetchImplementation(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load knowledge relationships: ${response.status} ${response.statusText}`);
    }
    return this.setCatalogue(await response.json());
  }

  setCatalogue(catalogue) {
    if (!catalogue || !Array.isArray(catalogue.relationships)) {
      throw new Error('Knowledge relationship catalogue must contain a relationships array.');
    }
    this.catalogue = catalogue;
    this.byId.clear();
    this.outgoing.clear();
    this.incoming.clear();

    for (const edge of catalogue.relationships) {
      if (!edge || !edge.id) continue;
      if (this.byId.has(edge.id)) {
        console.warn(`[KnowledgeGraphService] Duplicate relationship id detected: ${edge.id}`);
      }
      this.byId.set(edge.id, edge);

      const fromKey = keyOf(edge.from);
      const toKey = keyOf(edge.to);

      if (!this.outgoing.has(fromKey)) this.outgoing.set(fromKey, []);
      if (!this.incoming.has(toKey)) this.incoming.set(toKey, []);

      this.outgoing.get(fromKey).push(edge);
      this.incoming.get(toKey).push(edge);
    }

    this.loaded = true;
    return catalogue;
  }

  ensureLoaded() {
    if (!this.loaded || !this.catalogue) {
      throw new Error('Knowledge relationship catalogue has not been loaded.');
    }
  }

  getRelationship(id) {
    this.ensureLoaded();
    return this.byId.get(id) ?? null;
  }

  getOutgoing(ref, relation = null) {
    this.ensureLoaded();
    const edges = this.outgoing.get(keyOf(ref)) ?? [];
    return clone(relation ? edges.filter((edge) => edge.relation === relation) : edges);
  }

  getIncoming(ref, relation = null) {
    this.ensureLoaded();
    const edges = this.incoming.get(keyOf(ref)) ?? [];
    return clone(relation ? edges.filter((edge) => edge.relation === relation) : edges);
  }

  neighbours(ref, options = {}) {
    this.ensureLoaded();
    const direction = options.direction ?? 'both';
    const relation = options.relation ?? null;
    const edges = [];
    if (direction === 'outgoing' || direction === 'both') edges.push(...this.getOutgoing(ref, relation));
    if (direction === 'incoming' || direction === 'both') edges.push(...this.getIncoming(ref, relation));
    return edges;
  }

  trace(startRef, options = {}) {
    this.ensureLoaded();
    const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 4;
    const allowedRelations = options.relations ? new Set(options.relations) : null;
    const queue = [{ ref: startRef, depth: 0, path: [] }];
    const paths = [];
    const visitedDepth = new Map([[keyOf(startRef), 0]]);

    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) continue;
      for (const edge of this.getOutgoing(current.ref)) {
        if (allowedRelations && !allowedRelations.has(edge.relation)) continue;
        const path = [...current.path, edge];
        paths.push(path);
        const nextKey = keyOf(edge.to);
        const nextDepth = current.depth + 1;
        if (!visitedDepth.has(nextKey) || visitedDepth.get(nextKey) > nextDepth) {
          visitedDepth.set(nextKey, nextDepth);
          queue.push({ ref: edge.to, depth: nextDepth, path });
        }
      }
    }
    return paths;
  }

  explainPath(path) {
    if (!Array.isArray(path)) return [];
    return path.map((edge) => ({
      relationshipId: edge.id,
      from: edge.from,
      relation: edge.relation,
      to: edge.to,
      mechanism: edge.mechanism,
      conditions: edge.conditions ?? [],
      sources: edge.sources
    }));
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
export const createKnowledgeGraphService = (options = {}) => new KnowledgeGraphService(options);