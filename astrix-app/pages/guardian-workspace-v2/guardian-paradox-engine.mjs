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
  return equippedComponents(build).map(item => ({
    ...item,
    effects: descriptionEffects(item)
  }));
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
          evidence: {
            producer: producer.description,
            consumer: consumer.description,
            source: 'bungie-manifest-description'
          }
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
      if (!available.has(effect)) {
        missing.push({
          type: 'missing-input',
          effect,
          consumer: { hash: node.hash, name: node.name, type: node.type },
          statement: `${node.name} has explicit ${effect} dependency evidence, but no equipped component has verified ${effect} output evidence.`,
          evidence: node.description
        });
      }
    }
  }
  return missing;
}

function weaponContribution(nodes, loop) {
  return nodes.filter(n => n.type === 'weapon').map(weapon => {
    const outgoing = loop.filter(x => x.from.hash === weapon.hash);
    const incoming = loop.filter(x => x.to.hash === weapon.hash);
    const roles = uniq([
      ...outgoing.map(x => `supplies ${x.output} to ${x.to.name}`),
      ...incoming.map(x => `uses ${x.input} from ${x.from.name}`)
    ]);
    const verified = !weapon.unresolved && roles.length > 0;
    return {
      hash: weapon.hash,
      name: weapon.name,
      status: weapon.unresolved ? 'unresolved' : verified ? 'verified-loop-contributor' : 'insufficient-evidence',
      roles,
      evidence: verified ? weapon.description : null,
      note: verified ? null : weapon.unresolved
        ? 'Weapon identity is unresolved; no loop claim made.'
        : 'No explicit causal contribution can be proven from available fixture/manifest evidence; no loop claim made.'
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
  if (!profile || (typeof profile === 'object' && Object.keys(profile).length === 0)) {
    return { status: 'not-supplied', chains: [], note: 'No activity counter evidence was supplied with this Alpha fixture.' };
  }

  const requirements = Array.isArray(profile.requirements) ? profile.requirements : [];
  const outputs = new Set(nodes.flatMap(n => n.effects.outputs));
  const chains = requirements.map(req => {
    const effect = canonEffect(req?.effect ?? req?.requires ?? '');
    const sources = nodes.filter(n => n.effects.outputs.includes(effect));
    return {
      requirement: req,
      satisfied: Boolean(effect && outputs.has(effect)),
      chains: sources.map(s => `${s.name} -> ${effect} -> activity requirement`),
      evidence: sources.map(s => s.description)
    };
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

  const level = blockers.includes('unresolved-identities') ? 'low'
    : loop.length >= 3 && missing.length === 0 ? 'high'
    : loop.length ? 'medium'
    : 'insufficient';

  return {
    level,
    evidence: {
      equippedComponents: nodes.length,
      directedLinks: loop.length,
      unresolvedItems: unresolvedNodes.length,
      fixtureUnresolvedHashes: betaUnresolved,
      componentsWithoutDescription: noDescription.length,
      missingInputs: missing.length
    },
    blockers,
    statement: blockers.length
      ? `Confidence limited by: ${blockers.join(', ')}.`
      : 'All reported causal links are supported by available explicit fixture/manifest evidence.'
  };
}

function strengthsFromLoop(loop) {
  return loop.map(link => ({
    type: 'directed-synergy',
    statement: link.chain,
    reason: `${link.from.name} has verified ${link.output} output evidence that feeds ${link.to.name}'s verified ${link.input} input evidence.`,
    evidence: link.evidence
  }));
}

function evidenceWeakLinks(nodes, missing, weaponRows) {
  const rows = [...missing];
  for (const node of nodes.filter(n => n.unresolved)) {
    rows.push({
      type: 'unresolved-identity',
      item: { hash: node.hash, name: node.name, type: node.type },
      statement: `${node.name} is unresolved, so Paradox will not infer an effect or synergy role.`
    });
  }
  for (const weapon of weaponRows.filter(w => w.status === 'insufficient-evidence')) {
    rows.push({
      type: 'weapon-evidence-gap',
      item: { hash: weapon.hash, name: weapon.name, type: 'weapon' },
      statement: `${weapon.name} is resolved, but its loop contribution is not proven by the available Alpha evidence.`
    });
  }
  return rows;
}

function recommendationsFromWeakLinks(weakLinks) {
  const recs = [];
  for (const gap of weakLinks) {
    if (gap.type === 'missing-input') {
      recs.push({
        change: `Equip or select a verified source of ${gap.effect}.`,
        reason: `${gap.consumer.name} has explicit evidence that consumes/depends on ${gap.effect}, but the current fixture has no verified source for it.`,
        causalImpact: `Adds the missing ${gap.effect} output -> ${gap.consumer.name} input link.`,
        evidence: gap.evidence,
        actionable: true
      });
    } else if (gap.type === 'unresolved-identity') {
      recs.push({
        change: `Resolve ${gap.item.name} before making a gameplay recommendation for that slot.`,
        reason: 'The item identity/effect evidence is unresolved.',
        causalImpact: 'Prevents Paradox from inventing a causal link for unknown data.',
        evidence: { hash: gap.item.hash },
        actionable: false
      });
    }
  }
  return recs;
}

export function analyzeGuardianBuild(build = {}) {
  if (build?.source && build.source !== ALPHA_SOURCE) {
    throw new Error(`Paradox Alpha engine rejected non-fixture source: ${build.source}`);
  }

  const nodes = buildEvidenceNodes(build);
  const buildLoop = makeLoop(nodes);
  const missing = missingInputs(nodes);
  const weapons = weaponContribution(nodes, buildLoop);
  const weakLinks = evidenceWeakLinks(nodes, missing, weapons);

  return {
    fixtureId: build.fixtureId ?? null,
    source: 'paradox-alpha-deterministic-engine',
    buildLoop,
    strengths: strengthsFromLoop(buildLoop),
    weakLinks,
    weaponContribution: weapons,
    artifactFit: artifactFit(nodes, buildLoop, build),
    activityCounters: activityCounters(build, nodes),
    confidence: confidence(build, nodes, buildLoop, missing),
    recommendations: recommendationsFromWeakLinks(weakLinks)
  };
}

export function compareAnalysisMutation(beforeBuild, afterBuild) {
  const before = analyzeGuardianBuild(beforeBuild);
  const after = analyzeGuardianBuild(afterBuild);
  const signature = result => JSON.stringify({
    loops: result.buildLoop.map(x => x.chain).sort(),
    weakLinks: result.weakLinks.map(x => x.statement).sort(),
    recommendations: result.recommendations.map(x => [x.change, x.causalImpact]).sort()
  });
  return {
    changed: signature(before) !== signature(after),
    before,
    after
  };
}

let currentBuild = null;
let currentArtifact = null;
let currentAnalysis = null;

function mergedBuild() {
  if (!currentBuild) return null;
  if (!currentArtifact) return currentBuild;
  return {
    ...currentBuild,
    artifact: {
      ...(currentBuild.artifact ?? {}),
      ...(currentArtifact.artifact ?? {}),
      perks: currentArtifact.perks ?? currentBuild.artifact?.perks ?? []
    }
  };
}

function recompute(reason) {
  const build = mergedBuild();
  if (!build) return null;
  try {
    currentAnalysis = analyzeGuardianBuild(build);
    document.dispatchEvent(new CustomEvent(EVENT_ANALYSIS, {
      detail: { ...currentAnalysis, reason }
    }));
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
  current: () => currentAnalysis,
  recompute: () => recompute('manual')
};
