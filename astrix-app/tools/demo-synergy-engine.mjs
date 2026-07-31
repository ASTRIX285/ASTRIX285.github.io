import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveBuildAspectIds } from '../aspect-linkage.mjs';
import {
  ARTIFACT_RECOMMENDATION_LIMIT,
  recommendSynergies
} from '../synergy-engine.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(toolDirectory, '..', 'data', 'armor-3-components.json');
const buildsPath = path.resolve(toolDirectory, '..', 'data', 'armor-3-builds.json');

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

function assertExpectedVoidTruePositive(result) {
  const fragmentIds = result.recommendations.fragments.recommendations.map(
    (recommendation) => recommendation.componentId
  );

  if (!fragmentIds.includes('fragment-echo-of-starvation')) {
    throw new Error(
      'Expected fragment-echo-of-starvation to be recommended for Feed the Void + Child of the Old Gods.'
    );
  }

  const starvation = result.recommendations.fragments.recommendations.find(
    (recommendation) => recommendation.componentId === 'fragment-echo-of-starvation'
  );
  const devourReason = starvation.reasons.find(
    (reason) => reason.ruleCode === 'shared-devour'
  );

  if (!devourReason) {
    throw new Error('Echo of Starvation is missing its traceable Devour reason.');
  }
  if (devourReason.rulePriority !== 1 || starvation.reasons[0] !== devourReason) {
    throw new Error('Echo of Starvation must display its priority-1 Devour reason first.');
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

const [catalogue, buildCatalogue] = await Promise.all([
  readFile(cataloguePath, 'utf8').then(JSON.parse),
  readFile(buildsPath, 'utf8').then(JSON.parse)
]);

assertAllBuildAspectsResolve(buildCatalogue, catalogue);

const voidBuild = buildCatalogue.builds.find(
  (build) => build.id === 'warlock-void-skull-nova-control'
);
const aspectLinks = resolveBuildAspectIds(voidBuild, catalogue.components);
const result = recommendSynergies({
  catalogue,
  buildContext: {
    buildId: voidBuild.id,
    class: voidBuild.class,
    subclass: voidBuild.subclass,
    element: voidBuild.subclass,
    aspectIds: aspectLinks.resolvedIds,
    activity: voidBuild.activityTags[0]
  }
});

assertTraceableRecommendations(result, catalogue);
assertExpectedVoidTruePositive(result);
console.log(JSON.stringify(result, null, 2));
