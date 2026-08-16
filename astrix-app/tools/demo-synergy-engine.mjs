import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveBuildAspectIds } from '../aspect-linkage.mjs';
import {
  ARTIFACT_RECOMMENDATION_LIMIT,
  EFFECT_RULES,
  recommendSynergies
} from '../synergy-engine.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(toolDirectory, '..', 'data', 'armor-3-components.json');
const buildsPath = path.resolve(toolDirectory, '..', 'data', 'armor-3-builds.json');
const ELEMENTS = ['Void', 'Solar', 'Arc', 'Stasis', 'Strand', 'Prismatic'];
const ELEMENT_PREFIX = {
  Void: 'void-',
  Solar: 'solar-',
  Arc: 'arc-',
  Stasis: 'stasis-',
  Strand: 'strand-',
  Prismatic: 'prismatic-'
};

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholeTerm(text, term) {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term).trim();
  if (!normalizedTerm) return false;
  return new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}(?=$|[^a-z0-9])`,
    'i'
  ).test(normalizedText);
}

function ruleMatchesText(rule, text) {
  return rule.terms.some((term) => containsWholeTerm(text, term));
}

function assertTraceableRecommendations(result, catalogue) {
  const byId = new Map(catalogue.components.map((component) => [component.id, component]));
  const sections = Object.values(result.recommendations);

  for (const section of sections) {
    for (const recommendation of section.recommendations) {
      const component = byId.get(recommendation.componentId);

      if (!component) {
        throw new Error(`Recommendation ${recommendation.componentId} is missing from the catalogue.`);
      }
      if (component.verified !== true) {
        throw new Error(`Recommendation ${recommendation.componentId} is not verified.`);
      }
      if (typeof component.effect !== 'string' || component.effect.trim().length === 0) {
        throw new Error(`Recommendation ${recommendation.componentId} has an empty effect.`);
      }
      if (!Array.isArray(recommendation.reasons) || recommendation.reasons.length === 0) {
        throw new Error(`Recommendation ${recommendation.componentId} has no traceable reason.`);
      }

      let previousPriority = 0;
      for (const reason of recommendation.reasons) {
        if (!reason.ruleCode) {
          throw new Error(`Recommendation ${recommendation.componentId} has a reason without a rule code.`);
        }
        if (!Number.isInteger(reason.rulePriority) || reason.rulePriority < 1) {
          throw new Error(`Recommendation ${recommendation.componentId} has an invalid rule priority.`);
        }
        if (reason.rulePriority < previousPriority) {
          throw new Error(`Recommendation ${recommendation.componentId} reasons are not sorted by rule priority.`);
        }
        previousPriority = reason.rulePriority;

        if (!Array.isArray(reason.matchedKeywords) || reason.matchedKeywords.length === 0) {
          throw new Error(`Recommendation ${recommendation.componentId} has no matched keywords.`);
        }
        if (!Array.isArray(reason.supportingComponentIds) || reason.supportingComponentIds.length < 2) {
          throw new Error(`Recommendation ${recommendation.componentId} has incomplete supporting component ids.`);
        }
        if (!Array.isArray(reason.sourceRefs) || reason.sourceRefs.length === 0) {
          throw new Error(`Recommendation ${recommendation.componentId} has no supporting source refs.`);
        }
      }
    }
  }

  const fragmentCount = result.recommendations.fragments.recommendations.length;
  if (fragmentCount > result.fragmentSlotLimit) {
    throw new Error(
      `Recommended ${fragmentCount} fragments for ${result.fragmentSlotLimit} available slots.`
    );
  }

  const artifactRecommendations = result.recommendations.artifactPerks.recommendations;
  if (artifactRecommendations.length > ARTIFACT_RECOMMENDATION_LIMIT) {
    throw new Error(
      `Recommended ${artifactRecommendations.length} artifact perks; limit is ${ARTIFACT_RECOMMENDATION_LIMIT}.`
    );
  }

  const artifactNames = artifactRecommendations.map((recommendation) => recommendation.name);
  if (new Set(artifactNames).size !== artifactNames.length) {
    throw new Error('Artifact perk recommendations contain duplicate perk names.');
  }

  for (const recommendation of artifactRecommendations) {
    if (!Array.isArray(recommendation.artifactNames) || recommendation.artifactNames.length === 0) {
      throw new Error(`Artifact recommendation ${recommendation.componentId} has no artifact-name list.`);
    }
    for (const reason of recommendation.reasons) {
      if (!Array.isArray(reason.artifactNames) || reason.artifactNames.length === 0) {
        throw new Error(`Artifact recommendation ${recommendation.componentId} has a reason without artifact names.`);
      }
    }
  }
}

function assertElementSpecificFragmentMatch(result, element) {
  const recommendations = result.recommendations.fragments.recommendations;
  if (recommendations.length === 0) {
    throw new Error(`${element} demo returned no fragment recommendations.`);
  }

  const prefix = ELEMENT_PREFIX[element];
  const specificReason = recommendations
    .flatMap((recommendation) => recommendation.reasons)
    .find((reason) => reason.ruleCode.startsWith(prefix));

  if (!specificReason) {
    throw new Error(`${element} demo returned no element-specific fragment reason.`);
  }

  const firstGenericPriority = EFFECT_RULES.find(
    (rule) => rule.code.startsWith('generic-')
  )?.priority;
  if (!firstGenericPriority || specificReason.rulePriority >= firstGenericPriority) {
    throw new Error(`${element} element-specific rule did not outrank generic rules.`);
  }
}

function assertExpectedVoidTruePositive(result) {
  const starvation = result.recommendations.fragments.recommendations.find(
    (recommendation) => recommendation.componentId === 'fragment-echo-of-starvation'
  );

  if (!starvation) {
    throw new Error(
      'Expected fragment-echo-of-starvation to be recommended for Feed the Void + Child of the Old Gods.'
    );
  }

  const devourReason = starvation.reasons.find(
    (reason) => reason.ruleCode === 'void-devour'
  );

  if (!devourReason) {
    throw new Error('Echo of Starvation is missing its traceable Devour reason.');
  }
  if (starvation.reasons[0] !== devourReason) {
    throw new Error('Echo of Starvation must display its highest-priority Devour reason first.');
  }
}

function assertExpectedVoidWeakenMatch(result) {
  const weakenRecommendation = result.recommendations.fragments.recommendations.find(
    (recommendation) => recommendation.reasons.some(
      (reason) => reason.ruleCode === 'void-weaken'
    )
  );

  if (!weakenRecommendation) {
    throw new Error(
      'Void Nova Control must return at least one fragment recommendation with a void-weaken reason.'
    );
  }
}

function assertAllBuildAspectsResolve(buildCatalogue, componentCatalogue) {
  for (const build of buildCatalogue.builds) {
    const links = resolveBuildAspectIds(build, componentCatalogue.components);
    const expectedCount = build.subclassSetup.aspectIds?.length || build.subclassSetup.aspects.length;

    if (links.unresolved.length > 0) {
      throw new Error(
        `Build ${build.id} has unresolved aspects: ${JSON.stringify(links.unresolved)}`
      );
    }
    if (links.resolvedIds.length !== expectedCount) {
      throw new Error(
        `Build ${build.id} resolved ${links.resolvedIds.length} of ${expectedCount} aspects.`
      );
    }
  }

  const hunter = buildCatalogue.builds.find(
    (build) => build.id === 'hunter-solar-wormhusk-team-cure'
  );
  const fallbackBuild = {
    ...hunter,
    subclassSetup: {
      ...hunter.subclassSetup,
      aspectIds: undefined,
      aspects: ["  knock   'EM   down  ", ' on your mark ']
    }
  };
  const fallbackLinks = resolveBuildAspectIds(fallbackBuild, componentCatalogue.components);

  if (fallbackLinks.unresolved.length > 0 || !fallbackLinks.resolvedIds.includes('aspect-knock-em-down')) {
    throw new Error('Case-insensitive, whitespace-tolerant aspect-name fallback failed.');
  }
}

function runDemo(catalogue, context) {
  const result = recommendSynergies({ catalogue, buildContext: context });
  assertTraceableRecommendations(result, catalogue);
  return result;
}

function vocabularyCoverage(catalogue) {
  const fragments = catalogue.components.filter(
    (component) => component.type === 'fragment' && component.verified === true
  );

  return Object.fromEntries(ELEMENTS.map((element) => {
    const elementFragments = fragments.filter(
      (fragment) => fragment.element === element || fragment.subclass === element
    );
    const specificRules = EFFECT_RULES.filter(
      (rule) => rule.code.startsWith(ELEMENT_PREFIX[element])
    );
    const specificMatches = elementFragments.filter(
      (fragment) => specificRules.some((rule) => ruleMatchesText(rule, fragment.effect))
    ).length;
    const anyMatches = elementFragments.filter(
      (fragment) => EFFECT_RULES.some((rule) => ruleMatchesText(rule, fragment.effect))
    ).length;

    return [element, {
      verifiedFragments: elementFragments.length,
      elementSpecificMatches: specificMatches,
      anyRuleMatches: anyMatches
    }];
  }));
}

const [catalogue, buildCatalogue] = await Promise.all([
  readFile(cataloguePath, 'utf8').then(JSON.parse),
  readFile(buildsPath, 'utf8').then(JSON.parse)
]);

assertAllBuildAspectsResolve(buildCatalogue, catalogue);

const voidBuild = buildCatalogue.builds.find(
  (build) => build.id === 'warlock-void-skull-nova-control'
);
const voidLinks = resolveBuildAspectIds(voidBuild, catalogue.components);
const voidResult = runDemo(catalogue, {
  buildId: voidBuild.id,
  class: voidBuild.class,
  subclass: voidBuild.subclass,
  element: voidBuild.subclass,
  aspectIds: voidLinks.resolvedIds,
  activity: voidBuild.activityTags[0]
});
assertExpectedVoidTruePositive(voidResult);
assertExpectedVoidWeakenMatch(voidResult);

const solarResult = runDemo(catalogue, {
  buildId: 'demo-titan-solar-sol-invictus-roaring-flames',
  class: 'Titan',
  subclass: 'Solar',
  element: 'Solar',
  aspectIds: ['aspect-sol-invictus', 'aspect-roaring-flames'],
  activity: 'Endgame PvE demo'
});
assertElementSpecificFragmentMatch(solarResult, 'Solar');

const arcResult = runDemo(catalogue, {
  buildId: 'demo-hunter-arc-tempest-strike-ascension',
  class: 'Hunter',
  subclass: 'Arc',
  element: 'Arc',
  aspectIds: ['aspect-tempest-strike', 'aspect-ascension'],
  activity: 'Endgame PvE demo'
});
assertElementSpecificFragmentMatch(arcResult, 'Arc');

console.log(JSON.stringify({
  vocabularyCoverage: vocabularyCoverage(catalogue),
  demos: {
    void: voidResult,
    solar: solarResult,
    arc: arcResult
  }
}, null, 2));
