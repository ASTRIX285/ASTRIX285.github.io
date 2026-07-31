import {
  ARTIFACT_RECOMMENDATION_LIMIT,
  EFFECT_RULES
} from './synergy-engine.mjs';

const COMPOSER_VERSION = '1.0.0';
const VALID_CLASSES = new Set(['Hunter', 'Titan', 'Warlock']);
const COMPOSABLE_TYPES = new Set(['aspect', 'fragment', 'setBonus', 'artifactPerk']);
const COVERAGE_LIMITATION = 'EFFECT_RULES is currently Void-weighted, so non-Void compositions may be partial or have fewer traceable matches.';
const STAT_LIMITATION = 'Full armour stat targeting is not available yet. Fragment statModifiers are surfaced, but complete stat optimisation awaits manifest-backed armour data.';

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function sourceRefs(records) {
  const seen = new Set();
  const refs = [];

  for (const record of records) {
    for (const source of record?.sources ?? []) {
      const key = [source.title, source.publisher, source.date, source.url ?? ''].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({
        title: source.title,
        publisher: source.publisher,
        date: source.date,
        ...(source.url ? { url: source.url } : {})
      });
    }
  }

  return refs;
}

function hasAnyTerm(text, terms) {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(term));
}

function matchingRules(leftText, rightText) {
  return EFFECT_RULES.filter(
    (rule) => hasAnyTerm(leftText, rule.terms) && hasAnyTerm(rightText, rule.terms)
  );
}

function isVerifiedComponent(component) {
  if (!component || component.verified !== true) return false;
  if (!isNonEmptyText(component.effect)) return false;
  if (!isNonEmptyArray(component.sources)) return false;

  if (component.type === 'aspect') {
    return VALID_CLASSES.has(component.class) && Number.isInteger(component.fragmentSlots);
  }

  if (component.type === 'fragment') {
    return Array.isArray(component.statModifiers);
  }

  if (component.type === 'setBonus') {
    return Boolean(
      isNonEmptyText(component.setBonus?.twoPiece?.effect) &&
      component.setBonus?.twoPiece?.verified === true &&
      isNonEmptyText(component.setBonus?.fourPiece?.effect) &&
      component.setBonus?.fourPiece?.verified === true
    );
  }

  if (component.type === 'artifactPerk') {
    return isNonEmptyText(component.artifactName) && Number.isInteger(component.column);
  }

  return false;
}

function matchesElement(component, element) {
  const requested = normalize(element);
  return normalize(component.element) === requested || normalize(component.subclass) === requested;
}

function validateExotic(exotic) {
  const errors = [];

  if (!exotic || typeof exotic !== 'object') {
    return ['Exotic anchor must be an object.'];
  }
  if (!isNonEmptyText(exotic.id)) errors.push('Exotic id is required.');
  if (!isNonEmptyText(exotic.name)) errors.push('Exotic name is required.');
  if (!VALID_CLASSES.has(exotic.class)) errors.push('Exotic class must be Hunter, Titan or Warlock.');
  if (!isNonEmptyText(exotic.element)) errors.push('Exotic element is required.');
  if (exotic.verified !== true) errors.push('Exotic anchor is not source-verified.');
  if (!isNonEmptyText(exotic.effect)) errors.push('Exotic effect is empty.');
  if (!isNonEmptyArray(exotic.sources)) errors.push('Exotic sources are missing.');

  return errors;
}

function candidateEffect(component) {
  if (component.type !== 'setBonus') return component.effect;
  return [
    component.effect,
    component.setBonus?.twoPiece?.effect,
    component.setBonus?.fourPiece?.effect
  ].filter(Boolean).join(' ');
}

function makeReason(rule, candidate, supportingRecords, summary) {
  return {
    ruleCode: rule.code,
    rulePriority: rule.priority,
    matchedKeywords: [rule.label],
    supportingComponentIds: [
      ...supportingRecords.map((record) => record.id),
      candidate.id
    ],
    sourceRefs: sourceRefs([...supportingRecords, candidate]),
    summary
  };
}

function collectMatches(candidate, supportingRecords) {
  const effect = candidateEffect(candidate);
  const matches = [];

  for (const supportingRecord of supportingRecords) {
    for (const rule of matchingRules(supportingRecord.effect, effect)) {
      matches.push({ rule, supportingRecord });
    }
  }

  return matches;
}

function ranking(matches) {
  return {
    highestPriority: matches.reduce(
      (best, match) => Math.min(best, match.rule.priority),
      Number.POSITIVE_INFINITY
    ),
    distinctRuleCount: new Set(matches.map((match) => match.rule.code)).size
  };
}

function compareRanked(left, right) {
  if (left.ranking.highestPriority !== right.ranking.highestPriority) {
    return left.ranking.highestPriority - right.ranking.highestPriority;
  }
  if (left.ranking.distinctRuleCount !== right.ranking.distinctRuleCount) {
    return right.ranking.distinctRuleCount - left.ranking.distinctRuleCount;
  }
  return left.candidate.id.localeCompare(right.candidate.id);
}

function rankCandidates(candidates, supportingRecords) {
  return candidates
    .map((candidate) => {
      const matches = collectMatches(candidate, supportingRecords);
      return { candidate, matches, ranking: ranking(matches) };
    })
    .filter((entry) => entry.matches.length > 0)
    .sort(compareRanked);
}

function reasonsFor(candidate, matches) {
  return matches
    .sort((left, right) => {
      if (left.rule.priority !== right.rule.priority) {
        return left.rule.priority - right.rule.priority;
      }
      return left.supportingRecord.id.localeCompare(right.supportingRecord.id);
    })
    .map(({ rule, supportingRecord }) => makeReason(
      rule,
      candidate,
      [supportingRecord],
      `${candidate.name} and ${supportingRecord.name} both reference ${rule.label}.`
    ));
}

function selectAspects(components, exotic) {
  const eligible = components
    .filter((component) => component.type === 'aspect')
    .filter((component) => component.class === exotic.class)
    .filter((component) => matchesElement(component, exotic.element));

  const ranked = rankCandidates(eligible, [exotic]);
  const selected = ranked.slice(0, 2).map(({ candidate, matches }) => ({
    componentId: candidate.id,
    name: candidate.name,
    effect: candidate.effect,
    fragmentSlots: candidate.fragmentSlots,
    reasons: reasonsFor(candidate, matches)
  }));

  return {
    status: selected.length === 2 ? 'ready' : 'partial',
    eligibleVerifiedComponents: eligible.length,
    selections: selected,
    unavailableReason: selected.length === 2
      ? null
      : `Only ${selected.length} verified aspect${selected.length === 1 ? '' : 's'} had a traceable keyword relationship with ${exotic.name}.`
  };
}

function selectFragments(components, exotic, selectedAspects) {
  const aspectRecords = selectedAspects.map((selection) => ({
    id: selection.componentId,
    name: selection.name,
    effect: selection.effect,
    sources: selection.reasons.flatMap((reason) => reason.sourceRefs)
  }));
  const supportingRecords = [exotic, ...aspectRecords];
  const slotLimit = selectedAspects.reduce((total, aspect) => total + aspect.fragmentSlots, 0);
  const eligible = components
    .filter((component) => component.type === 'fragment')
    .filter((component) => matchesElement(component, exotic.element));

  const ranked = rankCandidates(eligible, supportingRecords);
  const selections = ranked.slice(0, slotLimit).map(({ candidate, matches }) => ({
    componentId: candidate.id,
    name: candidate.name,
    effect: candidate.effect,
    statModifiers: candidate.statModifiers.map((modifier) => ({ ...modifier })),
    reasons: reasonsFor(candidate, matches)
  }));

  return {
    status: selections.length === slotLimit && slotLimit > 0 ? 'ready' : 'partial',
    fragmentSlotLimit: slotLimit,
    fragmentSlotsUsed: selections.length,
    eligibleVerifiedComponents: eligible.length,
    selections,
    unavailableReason: selections.length === slotLimit && slotLimit > 0
      ? null
      : slotLimit === 0
        ? 'No verified selected aspects granted fragment slots.'
        : `Only ${selections.length} of ${slotLimit} fragment slots could be filled with traceable verified matches.`
  };
}

function selectSetBonus(components, exotic, aspects, fragments) {
  const supportingRecords = [
    exotic,
    ...aspects.map((item) => ({ id: item.componentId, name: item.name, effect: item.effect, sources: item.reasons.flatMap((reason) => reason.sourceRefs) })),
    ...fragments.map((item) => ({ id: item.componentId, name: item.name, effect: item.effect, sources: item.reasons.flatMap((reason) => reason.sourceRefs) }))
  ];
  const eligible = components.filter((component) => component.type === 'setBonus');
  const ranked = rankCandidates(eligible, supportingRecords);
  const first = ranked[0];

  if (!first) {
    return {
      status: 'partial',
      eligibleVerifiedComponents: eligible.length,
      selection: null,
      unavailableReason: 'No verified set bonus had a traceable keyword relationship with the composed kit.'
    };
  }

  return {
    status: 'ready',
    eligibleVerifiedComponents: eligible.length,
    selection: {
      componentId: first.candidate.id,
      name: first.candidate.name,
      effect: first.candidate.effect,
      setBonus: first.candidate.setBonus,
      reasons: reasonsFor(first.candidate, first.matches)
    },
    unavailableReason: null
  };
}

function selectArtifactPerks(components, exotic, aspects, fragments) {
  const supportingRecords = [
    exotic,
    ...aspects.map((item) => ({ id: item.componentId, name: item.name, effect: item.effect, sources: item.reasons.flatMap((reason) => reason.sourceRefs) })),
    ...fragments.map((item) => ({ id: item.componentId, name: item.name, effect: item.effect, sources: item.reasons.flatMap((reason) => reason.sourceRefs) }))
  ];
  const eligible = components
    .filter((component) => component.type === 'artifactPerk')
    .filter((component) => matchesElement(component, exotic.element));

  const grouped = new Map();
  for (const component of eligible) {
    const key = normalize(component.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(component);
  }

  const rankedGroups = [...grouped.values()]
    .map((candidates) => {
      const matches = candidates.flatMap((candidate) => collectMatches(candidate, supportingRecords));
      return {
        candidates,
        matches,
        ranking: ranking(matches),
        candidate: [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0]
      };
    })
    .filter((entry) => entry.matches.length > 0)
    .sort(compareRanked)
    .slice(0, ARTIFACT_RECOMMENDATION_LIMIT);

  const selections = rankedGroups.map((entry) => ({
    componentId: entry.candidate.id,
    componentIds: entry.candidates.map((candidate) => candidate.id).sort(),
    name: entry.candidate.name,
    effect: entry.candidate.effect,
    artifactNames: [...new Set(entry.candidates.map((candidate) => candidate.artifactName))].sort(),
    columns: entry.candidates
      .map((candidate) => ({ artifactName: candidate.artifactName, column: candidate.column }))
      .sort((left, right) => left.artifactName.localeCompare(right.artifactName) || left.column - right.column),
    reasons: reasonsFor(entry.candidate, entry.matches)
  }));

  return {
    status: selections.length > 0 ? 'ready' : 'partial',
    recommendationLimit: ARTIFACT_RECOMMENDATION_LIMIT,
    eligibleVerifiedComponents: eligible.length,
    selections,
    unavailableReason: selections.length > 0
      ? null
      : 'No verified artifact perk had a traceable keyword relationship with the composed kit.'
  };
}

function failureResult(exotic, errors) {
  return {
    composerVersion: COMPOSER_VERSION,
    origin: 'engine-composed',
    verified: false,
    status: 'unavailable',
    claim: 'No build was composed because the Exotic anchor did not pass the source-verification gate.',
    exotic: exotic ?? null,
    errors,
    limitations: [COVERAGE_LIMITATION, STAT_LIMITATION]
  };
}

export function composeBuildFromExotic({ exotic, catalogue }) {
  const exoticErrors = validateExotic(exotic);
  if (!catalogue || !Array.isArray(catalogue.components)) {
    exoticErrors.push('catalogue.components must be an array.');
  }
  if (exoticErrors.length > 0) return failureResult(exotic, exoticErrors);

  const verifiedComponents = catalogue.components
    .filter((component) => COMPOSABLE_TYPES.has(component.type))
    .filter(isVerifiedComponent);

  const aspects = selectAspects(verifiedComponents, exotic);
  const fragments = selectFragments(verifiedComponents, exotic, aspects.selections);
  const setBonus = selectSetBonus(
    verifiedComponents,
    exotic,
    aspects.selections,
    fragments.selections
  );
  const artifactPerks = selectArtifactPerks(
    verifiedComponents,
    exotic,
    aspects.selections,
    fragments.selections
  );

  const partialSections = [aspects, fragments, setBonus, artifactPerks]
    .filter((section) => section.status !== 'ready');

  return {
    composerVersion: COMPOSER_VERSION,
    origin: 'engine-composed',
    verified: false,
    status: partialSections.length === 0 ? 'complete' : 'partial',
    claim: 'Every selected component is source-verified. This combination is engine-composed and has not been play-tested in-game.',
    exotic: {
      id: exotic.id,
      name: exotic.name,
      class: exotic.class,
      element: exotic.element,
      effect: exotic.effect,
      verified: true,
      sources: exotic.sources
    },
    composition: {
      aspects,
      fragments,
      setBonus,
      artifactPerks
    },
    limitations: [COVERAGE_LIMITATION, STAT_LIMITATION],
    gaps: partialSections
      .map((section) => section.unavailableReason)
      .filter(Boolean)
  };
}

export {
  COMPOSER_VERSION,
  COVERAGE_LIMITATION,
  STAT_LIMITATION
};
