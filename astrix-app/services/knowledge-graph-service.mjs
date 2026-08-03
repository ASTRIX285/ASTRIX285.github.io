const DEFAULT_RELATIONSHIPS_URL = './data/knowledge-relationships.json';

function keyOf(ref) {
  return `${ref.namespace}:${ref.id}`;
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
    this.byId = new Map();
    this.outgoing = new Map();
    this.incoming = new Map();
  }

  async load(options = {}) {
    const response = await this.fetchImplementation(options.url ?? this.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load knowledge relationships: ${response.status} ${response.statusText}`);
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
      if (this.byId.has(edge.id)) throw new Error(`Duplicate relationship id: ${edge.id}`);
      this.byId.set(edge.id, edge);
      const fromKey = keyOf(edge.from);
      const toKey = keyOf(edge.to);
      if (!this.outgoing.has(fromKey)) this.outgoing.set(fromKey, []);
      if (!this.incoming.has(toKey)) this.incoming.set(toKey, []);
      this.outgoing.get(fromKey).push(edge);
      this.incoming.get(toKey).push(edge);
    }
    return catalogue;
  }

  getRelationship(id) {
    return this.byId.get(id) ?? null;
  }

  getOutgoing(ref, relation = null) {
    const edges = this.outgoing.get(keyOf(ref)) ?? [];
    return clone(relation ? edges.filter((edge) => edge.relation === relation) : edges);
  }

  getIncoming(ref, relation = null) {
    const edges = this.incoming.get(keyOf(ref)) ?? [];
    return clone(relation ? edges.filter((edge) => edge.relation === relation) : edges);
  }

  neighbours(ref, options = {}) {
    const direction = options.direction ?? 'both';
    const relation = options.relation ?? null;
    const edges = [];
    if (direction === 'outgoing' || direction === 'both') edges.push(...this.getOutgoing(ref, relation));
    if (direction === 'incoming' || direction === 'both') edges.push(...this.getIncoming(ref, relation));
    return edges;
  }

  trace(startRef, options = {}) {
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
