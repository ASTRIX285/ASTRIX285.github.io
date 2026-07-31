const ENGINE_VERSION = '1.0.0';

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
];

const VALID_CLASSES = new Set(['Hunter', 'Titan', 'Warlock']);
const RECOMMENDATION_TYPES = new Set(['fragment', 'artifactPerk', 'setBonus']);

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
    return (
      Number.isInteger(component.fragmentSlots) &&
      isNonEmptyText(component.class)
    );
  }

  if (component.type === 'artifactPerk') {
    return (
      isNonEmptyText(component.artifactName) &&
      Number.isInteger(component.column)
    );
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

function makeReason(rule, candidate, supportingAspect, extraSummary) {
  return {
    ruleCode: rule.code,
    summary: extraSummary ?? `${candidate.name} and ${supportingAspect.name} both reference ${rule.label}.`,
    matchedKeywords: [rule.label],
    supportingComponentIds: [supportingAspect.id, candidate.id],
    sourceRefs: sourceRefs([supportingAspect, candidate])
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
      matches.push({ rule, aspect });
    }
  }

  return matches;
}

function deterministicCandidateOrder(left, right) {
  return left.id.localeCompare(right.id);
}

function recommendFragments(verifiedComponents, aspects, buildContext, slotLimit) {
  const eligible = verifiedComponents
    .filter((component) => component.type === 'fragment')
    .filter((component) => matchesBuildElement(component, buildContext))
    .sort(deterministicCandidateOrder);

  const recommendations = [];

  for (const candidate of eligible) {
    const matches = collectRuleMatches(candidate, aspects);
    if (matches.length === 0) continue;

    recommendations.push({
      componentId: candidate.id,
      name: candidate.name,
      type: candidate.type,
      effect: candidate.effect,
      statModifiers: candidate.statModifiers.map((modifier) => ({ ...modifier })),
      reasons: matches.map(({ rule, aspect }) => makeReason(rule, candidate, aspect))
    });

    if (recommendations.length >= slotLimit) break;
  }

  return sectionResult(
    recommendations,
    eligible.length,
    slotLimit === 0
      ? 'The selected aspects grant no fragment slots.'
      : 'No verified fragment shares an explicit effect keyword with the selected aspects.'
  );
}

function recommendArtifactPerks(verifiedComponents, aspects, buildContext) {
  const eligible = verifiedComponents
    .filter((component) => component.type === 'artifactPerk')
    .filter((component) => matchesBuildElement(component, buildContext))
    .sort(deterministicCandidateOrder);

  const recommendations = eligible.flatMap((candidate) => {
    const matches = collectRuleMatches(candidate, aspects);
    if (matches.length === 0) return [];

    return [{
      componentId: candidate.id,
      name: candidate.name,
      type: candidate.type,
      effect: candidate.effect,
      artifactName: candidate.artifactName,
      column: candidate.column,
      reasons: matches.map(({ rule, aspect }) => makeReason(rule, candidate, aspect))
    }];
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
    .filter((component) => matchesBuildElement(component, buildContext))
    .sort(deterministicCandidateOrder);

  const recommendations = eligible.flatMap((candidate) => {
    const matches = collectRuleMatches(candidate, aspects);
    if (matches.length === 0) return [];

    return [{
      componentId: candidate.id,
      name: candidate.name,
      type: candidate.type,
      effect: candidate.effect,
      setBonus: candidate.setBonus,
      reasons: matches.map(({ rule, aspect }) => makeReason(rule, candidate, aspect))
    }];
  });

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
    recommendations
  };
}

export { ENGINE_VERSION, EFFECT_RULES };
