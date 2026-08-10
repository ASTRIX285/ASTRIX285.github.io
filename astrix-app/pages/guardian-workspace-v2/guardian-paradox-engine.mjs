/* guardian-paradox-engine.mjs — Paradox Forge deterministic Alpha reasoning engine.
 *
 * ALPHA SCOPE ONLY:
 * - accepts normalized Guardian data from guardian-fixture-loader.mjs
 * - accepts Artifact state from guardian-artifact.mjs
 * - does not ingest DIM links or arbitrary external loadouts
 * - never invents Destiny effects; causal claims are derived only from explicit
 *   item descriptions / trait IDs already present in fixture + manifest evidence.
 */

const ALPHA_SOURCE = 'paradox-beta-fixture';
const EVENT_ANALYSIS = 'astrix:paradox-analysis-changed';

const EFFECT_TERMS = [
  'amplified','blind','cure','devour','freeze','frozen','ignite','ignition',
  'invisibility','invisible','jolt','overshield','radiant','restoration','scorch',
  'sever','shatter','slow','suspend','suppression','suppress','threadling',
  'unravel','volatile','weaken','weakened','woven mail'
];

const CANONICAL_EFFECT = new Map([
  ['frozen','freeze'],['ignition','ignite'],['invisible','invisibility'],
  ['suppress','suppression'],['weakened','weaken']
]);

const OUTPUT_PATTERNS = [
  /\b(grant|grants|gain|gains|become|becomes|apply|applies|inflict|inflicts|cause|causes|create|creates|spawn|spawns|emit|emits|release|releases)\b/i,
  /\b(freeze|freezes|ignite|ignites|jolt|jolts|blind|blinds|weaken|weakens|suppress|suppresses|scorch|scorches|suspend|suspends|sever|severs|unravel|unravels)\b/i
];

const INPUT_PATTERNS = [
  /\b(while|when|after|upon|against)\b/i,
  /\b(target|targets|combatant|combatants|enemy|enemies)\b.{0,36}\b(affected by|are|is|become|becomes)\b/i,
  /\b(defeat|defeating|defeats|kill|killing|kills|damage|damaging|hit|hitting)\b/i
];

const itemHash = item => Number(item?.hash ?? item?.bungieHash);
const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const uniq = values => [...new Set(values.filter(Boolean))];

function canonEffect(term) {
  const t = lower(term);
  return CANONICAL_EFFECT.get(t) ?? t;
}

function evidenceText(item) {
  return clean(item?.description ?? item?.officialDescription ?? item?.display?.description);
}

function traitIds(item) {
  const raw = item?.traitIds ?? item?.official?.traitIds ?? [];
  return Array.isArray(raw) ? raw.map(String) : [];
}

function unresolved(item) {
  return !item || item.unresolved === true || /^unresolved\b/i.test(clean(item?.name));
}

function sourceType(item, fallback = 'component') {
  return clean(item?.componentType ?? item?.sourceKind ?? fallback) || fallback;
}

function normalizeItem(item, fallbackType = 'component') {
  if (!item) return null;
  return {
    hash: Number.isFinite(itemHash(item)) ? itemHash(item) : null,
    name: clean(item.name ?? item.displayName) || (unresolved(item) ? 'Unresolved item' : 'Unnamed item'),
    type: sourceType(item, fallbackType),
    description: evidenceText(item),
    traitIds: traitIds(item),
    unresolved: unresolved(item),
    raw: item
  };
}

function equippedComponents(build) {
  const rows = [];
  const push = (value, type) => {
    const x = normalizeItem(value, type);
    if (x) rows.push(x);
  };
  push(build?.super, 'super');
  push(build?.classAbility, 'classAbility');
  push(build?.movement, 'movementAbility');
  push(build?.melee, 'melee');
  push(build?.grenade, 'grenade');
  (build?.aspects ?? []).forEach(x => push(x, 'aspect'));
  (build?.fragments ?? []).forEach(x => push(x, 'fragment'));
  (build?.weapons ?? []).forEach(x => push(x, 'weapon'));
  (build?.artifact?.perks ?? []).forEach(x => push(x, 'artifactPerk'));
  return rows;
}

function contextWindow(text, term, radius = 72) {
  const hay = lower(text);
  const needle = lower(term);
  const at = hay.indexOf(needle);
  if (at < 0) return '';
  return hay.slice(Math.max(0, at - radius), Math.min(hay.length, at + needle.length + radius));
}

function descriptionEffects(item) {
  if (!item?.description) return { outputs: [], inputs: [], mentions: [] };
  const text = lower(item.description);
  const mentions = EFFECT_TERMS.filter(term => text.includes(term));
  const outputs = [];
  const inputs = [];

  for (const term of mentions) {
    const window = contextWindow(text, term);
    const canonical = canonEffect(term);
    if (OUTPUT_PATTERNS.some(re => re.test(window))) outputs.push(canonical);
    if (INPUT_PATTERNS.some(re => re.test(window))) inputs.push(canonical);
  }

  const traits = item.traitIds.map(lower).join(' ');
  const supported = mentions.filter(term => traits.includes(canonEffect(term)) || traits.includes(term));

  return {
    outputs: uniq(outputs.filter(x => supported.length === 0 || supported.some(t => canonEffect(t) === x))),
    inputs: uniq(inputs.filter(x => supported.length === 0 || supported.some(t => canonEffect(t) === x))),
    mentions: uniq(mentions.map(canonEffect))
  };
}

function buildEvidenceNodes(build) {
  return equippedComponents(build).map(item => ({ ...item, effects: descriptionEffects(item) }));
}

function makeLoop(nodes) {
  const links = [];
  const seen = new Set();
  for (const consumer of nodes) {
    for (const effect of consumer.effects.inputs) {
      for (const producer of nodes) {
        if (producer === consumer || !producer.effects.outputs.includes(effect)) continue;
        const key = `${producer.hash}:${effect}:${consumer.hash}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({
          from: { hash: producer.hash, name: producer.name, type: producer.type },
          output: effect,
          to: { hash: consumer.hash, name: consumer.name, type: consumer.type },
          input: effect,
          chain: `${producer.name} -> ${effect} -> ${consumer.name}`,
          evidence: { producer: producer.description, consumer: consumer.description, source: 'bungie-manifest-description' }
        });
      }
    }
  }
  return links;
}

function missingInputs(nodes) {
  const available = new Set(nodes.flatMap(n => n.effects.outputs));
  const missing = [];
  for (const node of nodes) {
    for (const effect of node.effects.inputs) {
      if (!available.has(effect)) missing.push({
        type: 'missing-input', effect,
        consumer: { hash: node.hash, name: node.name, type: node.type },
        statement: `${node.name} has explicit ${effect} dependency evidence, but no equipped component has verified ${effect} output evidence.`,
        evidence: node.description
      });
    }
  }
  return missing;
}

function weaponContribution(nodes, loop) {
  return nodes.filter(n => n.type === 'weapon').map(weapon => {
    const outgoing = loop.filter(x => x.from.hash === weapon.hash);
    const incoming = loop.filter(x => x.to.hash === weapon.hash);
    const roles = uniq([...outgoing.map(x => `supplies ${x.output} to ${x.to.name}`), ...incoming.map(x => `uses ${x.input} from ${x.from.name}`)]);
    const verified = !weapon.unresolved && roles.length > 0;
    return {
      hash: weapon.hash, name: weapon.name,
      status: weapon.unresolved ? 'unresolved' : verified ? 'verified-loop-contributor' : 'insufficient-evidence',
      roles, evidence: verified ? weapon.description : null,
      note: verified ? null : weapon.unresolved ? 'Weapon identity is unresolved; no loop claim made.' : 'No explicit causal contribution can be proven from available fixture/manifest evidence; no loop claim made.'
    };
  });
}

function artifactFit(nodes, loop, build) {
  const perks = nodes.filter(n => n.type === 'artifactPerk');
  const contributing = perks.filter(p => loop.some(x => x.from.hash === p.hash || x.to.hash === p.hash));
  return {
    status: !build?.artifact ? 'not-supplied' : perks.length === 0 ? 'no-perks-selected' : contributing.length ? 'verified-contribution' : 'insufficient-evidence',
    selectedCount: perks.length,
    contributingPerks: contributing.map(p => ({ hash: p.hash, name: p.name })),
    note: contributing.length ? null : 'Artifact selection is known, but no causal Artifact link is provable from available descriptions.'
  };
}

function activityCounters(build, nodes) {
  const profile = build?.activityProfile ?? build?.activity ?? null;
  if (!profile || (typeof profile === 'object' && Object.keys(profile).length === 0)) return { status: 'not-supplied', chains: [], note: 'No activity counter evidence was supplied with this Alpha fixture.' };
  const requirements = Array.isArray(profile.requirements) ? profile.requirements : [];
  const outputs = new Set(nodes.flatMap(n => n.effects.outputs));
  const chains = requirements.map(req => {
    const effect = canonEffect(req?.effect ?? req?.requires ?? '');
    const sources = nodes.filter(n => n.effects.outputs.includes(effect));
    return { requirement: req, satisfied: Boolean(effect && outputs.has(effect)), chains: sources.map(s => `${s.name} -> ${effect} -> activity requirement`), evidence: sources.map(s => s.description) };
  });
  return { status: requirements.length ? 'evaluated' : 'insufficient-evidence', chains };
}

function confidence(build, nodes, loop, missing) {
  const unresolvedNodes = nodes.filter(n => n.unresolved);
  const noDescription = nodes.filter(n => !n.unresolved && !n.description);
  const betaUnresolved = Number(build?.beta?.unresolved ?? 0);
  const blockers = [];
  if (unresolvedNodes.length || betaUnresolved) blockers.push('unresolved-identities');
  if (noDescription.length) blockers.push('missing-effect-descriptions');
  if (!loop.length) blockers.push('no-verified-directed-links');
  if (missing.length) blockers.push('missing-loop-inputs');
  const level = blockers.includes('unresolved-identities') ? 'low' : loop.length >= 3 && missing.length === 0 ? 'high' : loop.length ? 'medium' : 'insufficient';
  return {
    level,
    evidence: { equippedComponents: nodes.length, directedLinks: loop.length, unresolvedItems: unresolvedNodes.length, fixtureUnresolvedHashes: betaUnresolved, componentsWithoutDescription: noDescription.length, missingInputs: missing.length },
    blockers,
    statement: blockers.length ? `Confidence limited by: ${blockers.join(', ')}.` : 'All reported causal links are supported by available explicit fixture/manifest evidence.'
  };
}

function strengthsFromLoop(loop) {
  return loop.map(link => ({ type: 'directed-synergy', statement: link.chain, reason: `${link.from.name} has verified ${link.output} output evidence that feeds ${link.to.name}'s verified ${link.input} input evidence.`, evidence: link.evidence }));
}

function evidenceWeakLinks(nodes, missing, weaponRows) {
  const rows = [...missing];
  for (const node of nodes.filter(n => n.unresolved)) rows.push({ type: 'unresolved-identity', item: { hash: node.hash, name: node.name, type: node.type }, statement: `${node.name} is unresolved, so Paradox will not infer an effect or synergy role.` });
  for (const weapon of weaponRows.filter(w => w.status === 'insufficient-evidence')) rows.push({ type: 'weapon-evidence-gap', item: { hash: weapon.hash, name: weapon.name, type: 'weapon' }, statement: `${weapon.name} is resolved, but its loop contribution is not proven by the available Alpha evidence.` });
  return rows;
}

function recommendationsFromWeakLinks(weakLinks) {
  const recs = [];
  for (const gap of weakLinks) {
    if (gap.type === 'missing-input') recs.push({ change: `Equip or select a verified source of ${gap.effect}.`, reason: `${gap.consumer.name} has explicit evidence that consumes/depends on ${gap.effect}, but the current fixture has no verified source for it.`, causalImpact: `Adds the missing ${gap.effect} output -> ${gap.consumer.name} input link.`, evidence: gap.evidence, actionable: true });
    else if (gap.type === 'unresolved-identity') recs.push({ change: `Resolve ${gap.item.name} before making a gameplay recommendation for that slot.`, reason: 'The item identity/effect evidence is unresolved.', causalImpact: 'Prevents Paradox from inventing a causal link for unknown data.', evidence: { hash: gap.item.hash }, actionable: false });
  }
  return recs;
}

function hasEvidence(value) {
  if (value == null) return false;
  if (typeof value === 'string') return clean(value).length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function endpointKey(endpoint) {
  const hash = Number(endpoint?.hash ?? endpoint?.bungieHash);
  return Number.isFinite(hash) ? `h:${hash}` : `n:${lower(endpoint?.name)}`;
}

function endpointMatchesNode(endpoint, node) {
  const hash = Number(endpoint?.hash ?? endpoint?.bungieHash);
  if (Number.isFinite(hash)) return Number(node?.hash) === hash;
  const name = lower(endpoint?.name);
  return Boolean(name) && lower(node?.name) === name;
}

function endpointIsEquipped(endpoint, nodes) {
  return Array.isArray(nodes) && nodes.some(node => endpointMatchesNode(endpoint, node));
}

function referencedItem(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.item && typeof row.item === 'object') return row.item;
  const hash = Number(row.hash ?? row.bungieHash);
  const name = clean(row.name);
  if (Number.isFinite(hash) || name) return { hash: Number.isFinite(hash) ? hash : null, name };
  return null;
}

function chainKey(link) {
  return `${endpointKey(link?.from)}|${canonEffect(link?.output)}|${endpointKey(link?.to)}`;
}

function runtimeLoopWithSource(loop) {
  return loop.map(link => ({ ...link, source: 'runtime-description-parsing', evidenceSources: [{ source: 'runtime-description-parsing', evidence: link.evidence }] }));
}

function normalizeCuratedChain(entry) {
  if (!entry || typeof entry !== 'object' || !hasEvidence(entry.evidence)) return null;
  const output = canonEffect(entry.output);
  const input = canonEffect(entry.input ?? entry.output);
  if (!entry.from || !entry.to || !output || !input) return null;
  const from = { hash: Number.isFinite(Number(entry.from.hash ?? entry.from.bungieHash)) ? Number(entry.from.hash ?? entry.from.bungieHash) : null, name: clean(entry.from.name), type: clean(entry.from.type) || 'component' };
  const to = { hash: Number.isFinite(Number(entry.to.hash ?? entry.to.bungieHash)) ? Number(entry.to.hash ?? entry.to.bungieHash) : null, name: clean(entry.to.name), type: clean(entry.to.type) || 'component' };
  if ((!from.name && from.hash == null) || (!to.name && to.hash == null)) return null;
  return { ...entry, from, output, to, input, chain: clean(entry.chain) || `${from.name || from.hash} -> ${output} -> ${to.name || to.hash}`, source: 'curated-fixture-data', evidenceSources: [{ source: 'curated-fixture-data', evidence: entry.evidence }] };
}

function mergeBuildLoop(runtimeLoop, curatedEntries, nodes) {
  const merged = new Map();
  for (const link of runtimeLoopWithSource(runtimeLoop)) merged.set(chainKey(link), link);
  for (const raw of Array.isArray(curatedEntries) ? curatedEntries : []) {
    const curated = normalizeCuratedChain(raw);
    if (!curated) continue;
    if (!endpointIsEquipped(curated.from, nodes) || !endpointIsEquipped(curated.to, nodes)) continue;
    const key = chainKey(curated);
    const existing = merged.get(key);
    if (!existing) merged.set(key, curated);
    else merged.set(key, { ...existing, source: 'runtime-description-parsing+curated-fixture-data', evidenceSources: [...(existing.evidenceSources ?? []), ...curated.evidenceSources] });
  }
  return [...merged.values()];
}

function curatedEvidenceRows(rows, type, nodes) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === 'object' && hasEvidence(row.evidence)).filter(row => { const item = referencedItem(row); return !item || endpointIsEquipped(item, nodes); }).map(row => ({ ...row, type: row.type ?? type, source: 'curated-fixture-data' }));
}

function mergeStatementRows(runtimeRows, curatedRows) {
  const out = [...runtimeRows];
  const seen = new Set(runtimeRows.map(row => lower(row?.statement)));
  for (const row of curatedRows) {
    const key = lower(row?.statement);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function mergeWeaponContribution(runtimeRows, curatedRows, nodes) {
  const verifiedCurated = curatedEvidenceRows(curatedRows, 'weapon-contribution', nodes).filter(row => endpointIsEquipped(row, nodes));
  const out = runtimeRows.map(row => ({ ...row }));
  for (const curated of verifiedCurated) {
    const hash = Number(curated.hash ?? curated.bungieHash);
    const at = out.findIndex(row => (Number.isFinite(hash) && Number(row.hash) === hash) || (!Number.isFinite(hash) && lower(row.name) === lower(curated.name)));
    if (at < 0) { out.push(curated); continue; }
    const current = out[at];
    out[at] = { ...current, ...curated, roles: uniq([...(current.roles ?? []), ...(curated.roles ?? [])]), source: current.source ? `${current.source}+curated-fixture-data` : 'curated-fixture-data', evidenceSources: [...(current.evidence ? [{ source: 'runtime-description-parsing', evidence: current.evidence }] : []), { source: 'curated-fixture-data', evidence: curated.evidence }] };
  }
  return out;
}

function manifestRows(cache) {
  const rows = [];
  const add = values => { if (Array.isArray(values)) rows.push(...values); };
  add(cache?.items);
  add(cache?.identities);
  add(cache?.extension?.items);
  add(cache?.extensions?.flatMap?.(x => x?.items ?? []) ?? []);
  return rows;
}

function manifestByHash(cache) {
  return new Map(manifestRows(cache).map(item => [Number(item?.bungieHash ?? item?.hash), item]));
}

function candidateEvidence(candidate, manifestItem) {
  const parts = [];
  const pushRows = rows => (Array.isArray(rows) ? rows : []).forEach(row => parts.push(clean(row?.description)));
  parts.push(clean(candidate?.evidence));
  pushRows(candidate?.ownedRoll);
  if (candidate?.intrinsic?.description) parts.push(clean(candidate.intrinsic.description));
  parts.push(evidenceText(manifestItem));
  pushRows(manifestItem?.perks);
  return uniq(parts).filter(Boolean);
}

function candidateEffectEvidence(candidate, manifestItem) {
  const parts = [];
  const pushRows = rows => (Array.isArray(rows) ? rows : []).forEach(row => parts.push(clean(row?.description)));
  parts.push(clean(candidate?.description));
  pushRows(candidate?.ownedRoll);
  if (candidate?.intrinsic?.description) parts.push(clean(candidate.intrinsic.description));
  parts.push(evidenceText(manifestItem));
  pushRows(manifestItem?.perks);
  return uniq(parts).filter(Boolean);
}

const RECOMMEND_EFFECT_TERMS = [
  { effect: 'grenade-energy', patterns: [/\bgrenade energy\b/i] },
  { effect: 'grenade-final-blow', patterns: [/\bgrenades?\b.{0,36}\b(?:final blows?|kills?)\b/i, /\b(?:final blows?|kills?)\b.{0,36}\bgrenades?\b/i] },
  { effect: 'matching-damage-grenade-final-blow', patterns: [/\bgrenades?\b.{0,48}\b(?:kills?|final blows?)\b.{0,48}\bsame damage type\b/i, /\bgrenades?\b.{0,48}\bsame damage type\b.{0,48}\b(?:kills?|final blows?)\b/i, /\bgrenade or melee kills?\b.{0,48}\bsame damage type\b/i] },
  { effect: 'element-debuffed-target', patterns: [/\b(?:arc|solar|void|stasis|strand)[ -]debuffed targets?\b/i] },
  { effect: 'class-ability-energy', patterns: [/\bclass ability energy\b/i, /\brift energy\b/i] },
  { effect: 'empowered-weapon-damage', patterns: [/\bempowered weapon (?:damage|hits?|final blows?|kills?)\b/i] },
  { effect: 'fusion-grenade-energy', patterns: [/\bfusion grenade energy\b/i] },
  { effect: 'fusion-grenade-final-blow', patterns: [/\bfusion grenades?\b.{0,36}\b(?:final blows?|kills?|defeating)\b/i, /\b(?:final blows?|kills?|defeating)\b.{0,36}\bfusion grenades?\b/i] }
];

const RECOMMEND_OUTPUT_PATTERNS = [
  ...OUTPUT_PATTERNS,
  /\b(generate|generates|generated|provide|provides|provided|return|returns|returned|restore|restores|restored|recharge|recharges|recharged|refund|refunds|refunded)\b/i
];

const RECOMMEND_INPUT_PATTERNS = [
  ...INPUT_PATTERNS,
  /\b(final blows?|from|with)\b/i
];

function sentenceWindows(text) {
  return clean(text).split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
}

function recommendationEffects(evidenceParts) {
  const text = (Array.isArray(evidenceParts) ? evidenceParts : [evidenceParts]).filter(Boolean).join(' ');
  const subclass = descriptionEffects({ description: text, traitIds: [] });
  const outputs = [...subclass.outputs];
  const inputs = [...subclass.inputs];
  const mentions = [...subclass.mentions];
  for (const sentence of sentenceWindows(text)) {
    for (const term of RECOMMEND_EFFECT_TERMS) {
      if (!term.patterns.some(re => re.test(sentence))) continue;
      mentions.push(term.effect);
      if (RECOMMEND_OUTPUT_PATTERNS.some(re => re.test(sentence))) outputs.push(term.effect);
      if (RECOMMEND_INPUT_PATTERNS.some(re => re.test(sentence))) inputs.push(term.effect);
    }
  }
  return { outputs: uniq(outputs), inputs: uniq(inputs), mentions: uniq(mentions) };
}

function anchorEndpoints(anchorChains) {
  const out = [];
  const seen = new Set();
  for (const chain of anchorChains) {
    for (const endpoint of [chain?.from, chain?.to]) {
      if (!endpoint) continue;
      const key = endpointKey(endpoint);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(endpoint);
    }
  }
  return out;
}

function anchorEvidenceParts(anchorChains) {
  return anchorChains.flatMap(chain => {
    const value = chain?.evidence;
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);
    if (value && typeof value === 'object') return Object.values(value).map(clean).filter(Boolean);
    return [];
  });
}

function actionChain(anchorChains, actionType = 'grenade') {
  return anchorChains.find(chain => lower(chain?.from?.type) === lower(actionType) && lower(chain?.output).includes('final-blow'))
    ?? anchorChains.find(chain => lower(chain?.from?.type) === lower(actionType))
    ?? null;
}

function anchorAction(anchorChains, actionType = 'grenade') {
  const active = actionChain(anchorChains, actionType);
  if (active?.from) return active.from;
  return anchorEndpoints(anchorChains).find(endpoint => lower(endpoint?.type) === lower(actionType)) ?? null;
}

function chainDamageType(chain) {
  const output = lower(chain?.output);
  const match = output.match(/^([a-z]+)-(?:ability|grenade)-final-blow$/);
  return match?.[1] ?? '';
}

function candidatePerkForEffect(candidate, manifestItem, effect) {
  const rows = [...(candidate?.ownedRoll ?? []), ...(manifestItem?.perks ?? [])];
  return rows.find(row => {
    const effects = recommendationEffects([row?.description]);
    return effects.inputs.includes(effect) || effects.outputs.includes(effect);
  }) ?? null;
}

function recommendationChain(from, output, to, input, evidence) {
  return {
    from: { hash: Number(from.hash), name: from.name, type: from.type },
    output,
    to: { hash: Number(to.hash), name: to.name, type: to.type },
    input,
    chain: `${from.name} -> ${output} -> ${to.name}`,
    evidence
  };
}

function anchorLoopNames(exotic, anchorChains) {
  const active = actionChain(anchorChains);
  const names = active ? [exotic?.name, active?.from?.name, active?.to?.name] : [exotic?.name, ...anchorEndpoints(anchorChains).map(x => x?.name)];
  return uniq(names.map(clean).filter(Boolean));
}

function displayEffect(effect) {
  return clean(effect).split('-').map(word => word ? `${word[0].toUpperCase()}${word.slice(1)}` : '').join(' ');
}

export function recommendBuildForExotic(exoticHash, vaultPool, manifestCache = {}) {
  const poolContext = Array.isArray(vaultPool) ? { vaultPool } : (vaultPool ?? {});
  const candidates = Array.isArray(poolContext.vaultPool) ? poolContext.vaultPool : [];
  const manifest = manifestByHash(manifestCache);
  const exoticPoolItem = Number(poolContext?.exotic?.hash) === Number(exoticHash) ? poolContext.exotic : null;
  const exoticManifest = manifest.get(Number(exoticHash));
  const exotic = exoticPoolItem || exoticManifest;
  if (!exotic) throw new Error(`Exotic ${exoticHash} is not resolved by the supplied inventory/manifest evidence.`);

  const anchorChains = (poolContext?.anchorEvidence?.synergyChains ?? []).map(normalizeCuratedChain).filter(Boolean);
  const anchorEffects = recommendationEffects(anchorEvidenceParts(anchorChains));
  const grenade = anchorAction(anchorChains, 'grenade');
  const grenadeChain = actionChain(anchorChains, 'grenade');
  const grenadeDamageType = chainDamageType(grenadeChain);
  const loopNames = anchorLoopNames(exotic, anchorChains);
  const recommendedWeapons = [];
  const recommendedArmor = [];
  const rejectedCandidates = [];
  const addedChains = [];

  for (const candidate of candidates) {
    const manifestItem = manifest.get(Number(candidate?.hash));
    const evidenceParts = candidateEvidence(candidate, manifestItem);
    const effectParts = candidateEffectEvidence(candidate, manifestItem);
    const effects = recommendationEffects(effectParts);
    const item = { hash: Number(candidate?.hash), name: clean(candidate?.name ?? manifestItem?.name), type: clean(candidate?.type ?? manifestItem?.sourceKind) || 'item' };

    if (candidate?.type === 'armor' && candidate?.exotic && Number(candidate.hash) !== Number(exoticHash)) {
      rejectedCandidates.push({ item, reason: `Cannot equip ${candidate.name} with anchor Exotic ${exotic.name}; both are Exotic armor.`, evidence: evidenceParts });
      continue;
    }

    let chain = null;
    let role = null;
    if (candidate?.type === 'weapon' && grenade && effects.outputs.includes('grenade-energy')) {
      chain = recommendationChain(item, 'grenade-energy', grenade, 'grenade-energy', { producer: evidenceParts, consumer: 'Documented Destiny ability mechanic: grenade energy is the resource spent to make the equipped grenade ability available.', source: 'bungie-manifest+documented-game-mechanic' });
      role = `Feeds grenade energy back into the ${exotic.name} ${grenade.name} loop.`;
    } else if (candidate?.type === 'weapon' && grenade && effects.inputs.includes('matching-damage-grenade-final-blow') && grenadeDamageType && lower(candidate?.damageType) === grenadeDamageType) {
      const perk = candidatePerkForEffect(candidate, manifestItem, 'matching-damage-grenade-final-blow');
      chain = recommendationChain(grenade, `matching-${grenadeDamageType}-grenade-final-blow`, item, 'matching-damage-grenade-final-blow', { producer: grenadeChain?.evidence ?? `${poolContext?.fixtureId ?? 'Anchor'} equips ${clean(candidate?.damageType)} ${grenade.name}.`, consumer: evidenceParts, source: 'curated-fixture+bungie-manifest' });
      role = `Consumes a ${candidate.damageType} ${grenade.name} kill to strengthen ${clean(perk?.name) || item.name} after its weapon-final-blow setup.`;
    } else if (candidate?.type === 'weapon' && grenade && effects.inputs.includes('grenade-final-blow')) {
      chain = recommendationChain(grenade, 'grenade-final-blow', item, 'grenade-final-blow', { producer: grenadeChain?.evidence ?? `${poolContext?.fixtureId ?? 'Anchor'} equips ${grenade.name}.`, consumer: evidenceParts, source: 'curated-fixture+bungie-manifest' });
      role = `Consumes ${grenade.name} final blows to increase weapon damage/handling.`;
    }

    if (chain) {
      const row = { item, role, chain, evidence: chain.evidence };
      if (candidate?.type === 'weapon') recommendedWeapons.push(row); else recommendedArmor.push(row);
      addedChains.push(chain);
      continue;
    }

    const redundant = effects.outputs.find(effect => anchorEffects.outputs.includes(effect));
    const elementDebuffInput = effectParts.join(' ').match(/\b(arc|solar|void|stasis|strand)[ -]debuffed targets?\b/i)?.[1];
    if (candidate?.type === 'weapon' && redundant) {
      const active = actionChain(anchorChains);
      const route = active ? `${active.from.name} -> ${active.to.name} -> ${displayEffect(redundant)}` : `${loopNames.join(' -> ')} -> ${displayEffect(redundant)}`;
      rejectedCandidates.push({ item, reason: `Produces ${displayEffect(redundant)}, but ${poolContext?.fixtureId ?? 'the supplied anchor'} already has a verified ${route} route; no new producer->consumer edge is proven.`, evidence: evidenceParts });
    } else if (elementDebuffInput) {
      const element = `${elementDebuffInput[0].toUpperCase()}${elementDebuffInput.slice(1).toLowerCase()}`;
      rejectedCandidates.push({ item, reason: `Requires a ${element}-debuffed target, but the verified ${poolContext?.fixtureId ?? 'anchor'} anchor chains do not establish weaken, volatile, or suppression as an input producer.`, evidence: evidenceParts });
    } else {
      rejectedCandidates.push({ item, reason: `No explicit producer/consumer relationship to the verified ${loopNames.join(' / ')} loop is present in the supplied evidence.`, evidence: evidenceParts });
    }
  }

  return {
    exotic: { hash: Number(exoticHash), name: clean(exotic?.name), type: clean(exotic?.type ?? exotic?.sourceKind ?? 'armor') },
    recommendedWeapons,
    recommendedArmor,
    buildLoop: [...anchorChains, ...addedChains],
    rejectedCandidates
  };
}

export function analyzeGuardianBuild(build = {}) {
  if (build?.source && build.source !== ALPHA_SOURCE) throw new Error(`Paradox Alpha engine rejected non-fixture source: ${build.source}`);
  const nodes = buildEvidenceNodes(build);
  const runtimeLoop = makeLoop(nodes);
  const buildLoop = mergeBuildLoop(runtimeLoop, build.synergyChains, nodes);
  const missing = missingInputs(nodes);
  const runtimeWeapons = weaponContribution(nodes, buildLoop);
  const weapons = mergeWeaponContribution(runtimeWeapons, build.weaponContribution, nodes);
  const runtimeWeakLinks = evidenceWeakLinks(nodes, missing, weapons);
  const weakLinks = mergeStatementRows(runtimeWeakLinks, curatedEvidenceRows(build.knownWeakLinks, 'curated-weak-link', nodes));
  const strengths = mergeStatementRows(strengthsFromLoop(buildLoop), curatedEvidenceRows(build.knownStrengths, 'curated-strength', nodes));
  const result = {
    fixtureId: build.fixtureId ?? null,
    source: 'paradox-alpha-deterministic-engine',
    buildLoop,
    strengths,
    weakLinks,
    weaponContribution: weapons,
    artifactFit: artifactFit(nodes, buildLoop, build),
    activityCounters: activityCounters(build, nodes),
    confidence: confidence(build, nodes, buildLoop, missing),
    recommendations: recommendationsFromWeakLinks(weakLinks)
  };
  if (build.buildFocus != null) result.buildFocus = build.buildFocus;
  return result;
}

export function compareAnalysisMutation(beforeBuild, afterBuild) {
  const before = analyzeGuardianBuild(beforeBuild);
  const after = analyzeGuardianBuild(afterBuild);
  const signature = result => JSON.stringify({ loops: result.buildLoop.map(x => x.chain).sort(), weakLinks: result.weakLinks.map(x => x.statement).sort(), recommendations: result.recommendations.map(x => [x.change, x.causalImpact]).sort() });
  return { changed: signature(before) !== signature(after), before, after };
}

let currentBuild = null;
let currentArtifact = null;
let currentAnalysis = null;

function mergedBuild() {
  if (!currentBuild) return null;
  if (!currentArtifact) return currentBuild;
  return { ...currentBuild, artifact: { ...(currentBuild.artifact ?? {}), ...(currentArtifact.artifact ?? {}), perks: currentArtifact.perks ?? currentBuild.artifact?.perks ?? [] } };
}

function recompute(reason) {
  const build = mergedBuild();
  if (!build) return null;
  try {
    currentAnalysis = analyzeGuardianBuild(build);
    document.dispatchEvent(new CustomEvent(EVENT_ANALYSIS, { detail: { ...currentAnalysis, reason } }));
    return currentAnalysis;
  } catch (error) {
    console.error('[Paradox Alpha engine]', error);
    return null;
  }
}

function acceptFixture(detail) {
  if (!detail || detail.source !== ALPHA_SOURCE) return;
  currentBuild = detail;
  currentArtifact = null;
  recompute('fixture-change');
}

function acceptArtifact(detail) {
  if (!detail || detail.source !== 'paradox-artifact') return;
  if (currentBuild?.fixtureId && detail.fixtureId && currentBuild.fixtureId !== detail.fixtureId) return;
  currentArtifact = detail;
  recompute('artifact-change');
}

document.addEventListener('astrix:guardian-selection-changed', e => acceptFixture(e.detail));
document.addEventListener('astrix:beta-fixture-loaded', e => acceptFixture(e.detail));
document.addEventListener('astrix:artifact-selection-changed', e => acceptArtifact(e.detail));

globalThis.ASTRIXParadoxEngine = {
  analyze: analyzeGuardianBuild,
  compareMutation: compareAnalysisMutation,
  recommendForExotic: recommendBuildForExotic,
  current: () => currentAnalysis,
  recompute: () => recompute('manual')
};