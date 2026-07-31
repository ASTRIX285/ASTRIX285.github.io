import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ARTIFACT_RECOMMENDATION_LIMIT,
  recommendSynergies
} from '../synergy-engine.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(toolDirectory, '..', 'data', 'armor-3-components.json');

function findVerifiedAspectId(components, name) {
  const matches = components.filter(
    (component) =>
      component.type === 'aspect' &&
      component.name === name &&
      component.verified === true &&
      typeof component.effect === 'string' &&
      component.effect.trim().length > 0
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected one verified aspect named "${name}", found ${matches.length}.`
    );
  }

  return matches[0].id;
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

      for (const reason of recommendation.reasons) {
        if (!reason.ruleCode) {
          throw new Error(`Recommendation ${recommendation.componentId} has a reason without a rule code.`);
        }
        if (!Number.isInteger(reason.rulePriority) || reason.rulePriority < 1) {
          throw new Error(`Recommendation ${recommendation.componentId} has an invalid rule priority.`);
        }
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
  if (devourReason.rulePriority !== 1) {
    throw new Error(
      `Expected Devour priority 1 for Echo of Starvation, found ${devourReason.rulePriority}.`
    );
  }
}

const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8'));
const aspectIds = [
  findVerifiedAspectId(catalogue.components, 'Feed the Void'),
  findVerifiedAspectId(catalogue.components, 'Child of the Old Gods')
];

const result = recommendSynergies({
  catalogue,
  buildContext: {
    buildId: 'demo-warlock-void-feed-the-void-child',
    class: 'Warlock',
    subclass: 'Void',
    element: 'Void',
    aspectIds,
    activity: 'Endgame PvE demo'
  }
});

assertTraceableRecommendations(result, catalogue);
assertExpectedVoidTruePositive(result);
console.log(JSON.stringify(result, null, 2));
