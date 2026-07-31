import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { recommendSynergies } from '../synergy-engine.mjs';

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
        if (!Array.isArray(reason.supportingComponentIds) || reason.supportingComponentIds.length < 2) {
          throw new Error(`Recommendation ${recommendation.componentId} has incomplete supporting component ids.`);
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
console.log(JSON.stringify(result, null, 2));
