const ENGINE_VERSION = '1.1.0';

const EFFECT_RULES = [
  { code: 'shared-devour', label: 'Devour', terms: ['devour'] },
  { code: 'shared-weaken', label: 'weaken', terms: ['weaken', 'weakened'] },
  { code: 'shared-volatile', label: 'Volatile', terms: ['volatile'] },
  { code: 'shared-invisibility', label: 'invisibility', terms: ['invisibility', 'invisible'] },
  { code: 'shared-overshield', label: 'Void Overshield', terms: ['void overshield', 'overshield'] },
  { code: 'shared-suppression', label: 'suppression', terms: ['suppress', 'suppressed', 'suppression'] },
  { code: 'shared-void-breach', label: 'Void Breach', terms: ['void breach'] },
  { code: 'shared-orb-of-power', label: 'Orb of Power', terms: ['orb of power', 'orbs of power'] },
  { code: 'shared-grenade', label: 'grenade', terms: ['grenade'] },
  { code: 'shared-melee', label: 'melee', terms: ['melee'] },
  { code: 'shared-class-ability', label: 'class ability', terms: ['class ability'] },
  { code: 'shared-super', label: 'Super', terms: ['super'] }
].map((rule, index) => ({ ...rule, priority: index + 1 }));

const VALID_CLASSES = new Set(['Hunter', 'Titan', 'Warlock']);
const RECOMMENDATION_TYPES = new Set(['fragment', 'artifactPerk', 'setBonus']);
const ARTIFACT_RECOMMENDATION_LIMIT = 6;

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
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

function sourceRefs(components) {
  const seen = new Set();
  const refs = [];

  for (const component of components) {
    for (const source of component?.sources ?? []) {
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

function isVerifiedComponent(component) {
  if (!component || component.verified !== true) return false;
  if (!isNonEmptyText(component.effect)) return false;
  if (!isNonEmptyArray(component.sources)) return false;

  if (component.type === 'fragment') {
    return Array.isArray(component.statModifiers);
  }

  if (component.type === 'aspect') {
    return Number.isInteger(component.fragmentSlots) && isNonEmptyText(component.class);
  }

  if (component.type === 'artifactPerk') {
    return isNonEmptyText(component.artifactName) && Number.isInteger(component.column);
  }

  if (component.type === 'setBonus') {
    return Boolean(
      isNonEmptyText(component.setBonus?.twoPiece?.name) &&
      isNonEmptyText(component.setBonus?.twoPiece?.effect) &&
      component.setBonus?.twoPiece?.verified === true &&
      isNonEmptyText(component.setBonus?.fourPiece?.name) &&
      isNonEmptyText(component.setBonus?.fourPiece?.effect) &&
      component.setBonus?.fourPiece?.verified === true
    );
  }

  return false;
}

function matchesBuildElement(component, buildContext) {
  const requested = normalize(buildContext.element || buildContext.subclass);
  if (!requested) return false;

  const componentElement = normalize(component.element);
  const componentSubclass = normalize(component.subclass);

  if (componentElement || componentSubclass) {
    return componentElement === requested || componentSubclass === requested;
  }

  return hasAnyTerm(component.effect, [requested]);
}

function resolveAspects(buildContext, verifiedComponentsById) {
  const requestedIds = Array.isArray(buildContext.aspectIds)
    ? [...new Set(buildContext.aspectIds)]
    : [];

  const resolved = [];
  const unavailable = [];

  for (const id of requestedIds) {
    const component = verifiedComponentsById.get(id);

    if (!component || component.type !== 'aspect') {
      unavailable.push({
        componentId: id,
        reason: 'Aspect is missing, unverified, incomplete or not an aspect.'
      });
      continue;
    }

    if (component.class !== buildContext.class) {
      unavailable.push({
        componentId: id,
        reason: `Aspect belongs to ${component.class}, not ${buildContext.class}.`
      });
      continue;
    }

    if (!matchesBuildElement(component, buildContext)) {
      unavailable.push({
        componentId: id,
        reason: 'Aspect does not match the requested subclass or element.'
      });
      continue;
    }

    resolved.push(component);
  }

  return { resolved, unavailable };
}

function makeReason(rule, candidate, supportingAspect, extra = {}) {
  return {
    ruleCode: rule.code,
    rulePriority: rule.priority,
    summary: extra.summary ?? `${candidate.name} and ${supportingAspect.name} both reference ${rule.label}.`,
    matchedKeywords: [rule.label],
    supportingComponentIds: extra.supportingComponentIds ?? [supportingAspect.id, candidate.id],
    sourceRefs: extra.sourceRefs ?? sourceRefs([supportingAspect, candidate]),
    ...(extra.artifactNames ? { artifactNames: extra.artifactNames } : {})
  };
}

function candidateEffect(component) {
  if (component.type !== 'setBonus') return component.effect;
  return [
    component.effect,
    component.setBonus?.twoPiece?.effect,
    component.setBonus?.fourPiece?.effect
  ].filter(Boolean).join(' ');
}

function collectRuleMatches(candidate, aspects) {
  const matches = [];
  const effect = candidateEffect(candidate);

  for (const aspect of aspects) {
    for (const rule of matchingRules(aspect.effect, effect)) {
      matches.push({ rule, aspect, candidate });
    }
  }

  return matches;
}

function rankingMetadata(matches) {
  const distinctRuleCodes = new Set(matches.map(({ rule }) => rule.code));
  const highestPriority = matches.reduce(
    (best, { rule }) => Math.min(best, rule.priority),
    Number.POSITIVE_INFINITY
  );

  return {
    highestPriority,
    distinctRuleCount: distinctRuleCodes.size
  };
}

function rankedCandidateOrder(left, right) {
  if (left.ranking.highestPriority !== right.ranking.highestPriority) {
    return left.ranking.highestPriority - right.ranking.highestPriority;
  }

  if (left.ranking.distinctRuleCount !== right.ranking.distinctRuleCount) {
    return right.ranking.distinctRuleCount - left.ranking.distinctRuleCount;
  }

  return left.deterministicId.localeCompare(right.deterministicId);
}

function buildRankedCandidates(eligible, aspects) {
  return eligible
    .map((candidate) => {
      const matches = collectRuleMatches(candidate, aspects);
      return {
        candidate,
        matches,
        ranking: rankingMetadata(matches),
        deterministicId: candidate.id
      };
    })
    .filter(({ matches }) => matches.length > 0)
    .sort(rankedCandidateOrder);
}

function recommendFragments(verifiedComponents, aspects, buildContext, slotLimit) {
  const eligible = verifiedComponents
    .filter((component) => component.type === 'fragment')
    .filter((component) => matchesBuildElement(component, buildContext));

  const recommendations = buildRankedCandidates(eligible, aspects)
    .slice(0, slotLimit)
    .map(({ candidate, matches }) => ({
      componentId: candidate.id,
      name: candidate.name,
      type: candidate.type,
      effect: candidate.effect,
      statModifiers: candidate.statModifiers.map((modifier) => ({ ...modifier })),
      reasons: matches.map(({ rule, aspect }) => makeReason(rule, candidate, aspect))
    }));

  return sectionResult(
    recommendations,
    eligible.length,
    slotLimit === 0
      ? 'The selected aspects grant no fragment slots.'
      : 'No verified fragment shares an explicit effect keyword with the selected aspects.'
  );
}

function groupArtifactCandidates(eligible, aspects) {
  const groups = new Map();

  for (const candidate of eligible) {
    const key = normalize(candidate.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }

  return [...groups.values()]
    .map((candidates) => {
      const matches = candidates.flatMap((candidate) => collectRuleMatches(candidate, aspects));
      const deterministicId = candidates
        .map((candidate) => candidate.id)
        .sort((left, right) => left.localeCompare(right))[0];

      return {
        candidates,
        matches,
        ranking: rankingMetadata(matches),
        deterministicId
      };
    })
    .filter(({ matches }) => matches.length > 0)
    .sort(rankedCandidateOrder);
}

function artifactReasons(group) {
  const artifactNames = [...new Set(group.candidates.map((candidate) => candidate.artifactName))]
    .sort((left, right) => left.localeCompare(right));
  const reasonsByRuleAndAspect = new Map();

  for (const match of group.matches) {
    const key = `${match.rule.code}|${match.aspect.id}`;
    if (!reasonsByRuleAndAspect.has(key)) {
      reasonsByRuleAndAspect.set(key, {
        rule: match.rule,
        aspect: match.aspect,
        candidates: []
      });
    }
    reasonsByRuleAndAspect.get(key).candidates.push(match.candidate);
  }

  return [...reasonsByRuleAndAspect.values()]
    .sort((left, right) => {
      if (left.rule.priority !== right.rule.priority) {
        return left.rule.priority - right.rule.priority;
      }
      return left.aspect.id.localeCompare(right.aspect.id);
    })
    .map(({ rule, aspect, candidates }) => {
      const supportingCandidates = [...new Map(
        candidates.map((candidate) => [candidate.id, candidate])
      ).values()].sort((left, right) => left.id.localeCompare(right.id));
      const representative = supportingCandidates[0];

      return makeReason(rule, representative, aspect, {
        summary: `${representative.name} appears in ${artifactNames.join(', ')} and shares ${rule.label} with ${aspect.name}.`,
        artifactNames,
        supportingComponentIds: [aspect.id, ...supportingCandidates.map((candidate) => candidate.id)],
        sourceRefs: sourceRefs([aspect, ...supportingCandidates])
      });
    });
}

function recommendArtifactPerks(verifiedComponents, aspects, buildContext) {
  const eligible = verifiedComponents
    .filter((component) => component.type === 'artifactPerk')
    .filter((component) => matchesBuildElement(component, buildContext));

  const recommendations = groupArtifactCandidates(eligible, aspects)
    .slice(0, ARTIFACT_RECOMMENDATION_LIMIT)
    .map((group) => {
      const canonical = [...group.candidates]
        .sort((left, right) => left.id.localeCompare(right.id))[0];
      const artifactNames = [...new Set(group.candidates.map((candidate) => candidate.artifactName))]
        .sort((left, right) => left.localeCompare(right));

      return {
        componentId: canonical.id,
        componentIds: group.candidates
          .map((candidate) => candidate.id)
          .sort((left, right) => left.localeCompare(right)),
        name: canonical.name,
        type: canonical.type,
        effect: canonical.effect,
        artifactNames,
        columns: group.candidates
          .map((candidate) => ({ artifactName: candidate.artifactName, column: candidate.column }))
          .sort((left, right) => {
            const artifactOrder = left.artifactName.localeCompare(right.artifactName);
            return artifactOrder !== 0 ? artifactOrder : left.column - right.column;
          }),
        reasons: artifactReasons(group)
      };
    });

  return sectionResult(
    recommendations,
    eligible.length,
    'No verified artifact perk matches both the build element and an explicit selected-aspect effect keyword.'
  );
}

function recommendSetBonuses(verifiedComponents, aspects, buildContext) {
  const eligible = verifiedComponents
    .filter((component) => component.type === 'setBonus')
    .filter((component) => matchesBuildElement(component, buildContext));

  const recommendations = buildRankedCandidates(eligible, aspects)
    .map(({ candidate, matches }) => ({
      componentId: candidate.id,
      name: candidate.name,
      type: candidate.type,
      effect: candidate.effect,
      setBonus: candidate.setBonus,
      reasons: matches.map(({ rule, aspect }) => makeReason(rule, candidate, aspect))
    }));

  return sectionResult(
    recommendations,
    eligible.length,
    'No verified gear set matches both the build element and an explicit selected-aspect effect keyword.'
  );
}

function sectionResult(recommendations, eligibleCount, emptyReason) {
  if (recommendations.length > 0) {
    return {
      status: 'ready',
      eligibleVerifiedComponents: eligibleCount,
      recommendations
    };
  }

  return {
    status: eligibleCount === 0
      ? 'insufficient verified component data'
      : 'no applicable verified component',
    eligibleVerifiedComponents: eligibleCount,
    recommendations: [],
    unavailableReason: eligibleCount === 0
      ? 'No verified, complete component records are available for this category and build context.'
      : emptyReason
  };
}

function validateInput(buildContext, catalogue) {
  const errors = [];

  if (!buildContext || typeof buildContext !== 'object') {
    errors.push('buildContext must be an object.');
  } else {
    if (!VALID_CLASSES.has(buildContext.class)) {
      errors.push('buildContext.class must be Hunter, Titan or Warlock.');
    }
    if (!isNonEmptyText(buildContext.element) && !isNonEmptyText(buildContext.subclass)) {
      errors.push('buildContext.element or buildContext.subclass is required.');
    }
    if (!Array.isArray(buildContext.aspectIds) || buildContext.aspectIds.length === 0) {
      errors.push('buildContext.aspectIds must contain at least one aspect component id.');
    }
  }

  if (!catalogue || !Array.isArray(catalogue.components)) {
    errors.push('catalogue.components must be an array.');
  }

  return errors;
}

export function recommendSynergies({ buildContext, catalogue }) {
  const inputErrors = validateInput(buildContext, catalogue);

  if (inputErrors.length > 0) {
    return {
      engineVersion: ENGINE_VERSION,
      status: 'missing build linkage',
      input: buildContext ?? null,
      errors: inputErrors,
      recommendations: {
        fragments: sectionResult([], 0, 'Invalid build context.'),
        artifactPerks: sectionResult([], 0, 'Invalid build context.'),
        setBonuses: sectionResult([], 0, 'Invalid build context.')
      }
    };
  }

  const verifiedComponents = catalogue.components
    .filter((component) => RECOMMENDATION_TYPES.has(component.type) || component.type === 'aspect')
    .filter(isVerifiedComponent);
  const verifiedComponentsById = new Map(
    verifiedComponents.map((component) => [component.id, component])
  );

  const aspects = resolveAspects(buildContext, verifiedComponentsById);

  if (aspects.resolved.length === 0) {
    return {
      engineVersion: ENGINE_VERSION,
      status: 'insufficient verified component data',
      input: buildContext,
      resolvedAspectIds: [],
      unavailableAspects: aspects.unavailable,
      fragmentSlotLimit: 0,
      recommendations: {
        fragments: sectionResult([], 0, 'No verified selected aspect is available.'),
        artifactPerks: sectionResult([], 0, 'No verified selected aspect is available.'),
        setBonuses: sectionResult([], 0, 'No verified selected aspect is available.')
      }
    };
  }

  const fragmentSlotLimit = aspects.resolved.reduce(
    (total, aspect) => total + aspect.fragmentSlots,
    0
  );

  const recommendations = {
    fragments: recommendFragments(
      verifiedComponents,
      aspects.resolved,
      buildContext,
      fragmentSlotLimit
    ),
    artifactPerks: recommendArtifactPerks(
      verifiedComponents,
      aspects.resolved,
      buildContext
    ),
    setBonuses: recommendSetBonuses(
      verifiedComponents,
      aspects.resolved,
      buildContext
    )
  };

  const anyReady = Object.values(recommendations).some(
    (section) => section.status === 'ready'
  );

  return {
    engineVersion: ENGINE_VERSION,
    status: anyReady ? 'ready' : 'no applicable verified component',
    input: buildContext,
    resolvedAspectIds: aspects.resolved.map((aspect) => aspect.id),
    unavailableAspects: aspects.unavailable,
    fragmentSlotLimit,
    artifactRecommendationLimit: ARTIFACT_RECOMMENDATION_LIMIT,
    recommendations
  };
}

export {
  ARTIFACT_RECOMMENDATION_LIMIT,
  ENGINE_VERSION,
  EFFECT_RULES
};
