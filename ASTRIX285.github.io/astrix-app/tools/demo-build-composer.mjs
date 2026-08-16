import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { composeBuildFromExotic } from '../build-composer.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(toolDirectory, '..', 'data');

const [catalogue, builds] = await Promise.all([
  JSON.parse(await readFile(path.join(dataDirectory, 'armor-3-components.json'), 'utf8')),
  JSON.parse(await readFile(path.join(dataDirectory, 'armor-3-builds.json'), 'utf8'))
]);

function exoticFromBuild(build) {
  return {
    id: `exotic-${build.id}`,
    name: build.exoticArmor.name,
    class: build.class,
    element: build.subclass,
    effect: build.exoticArmor.reason,
    verified: build.exoticArmor.verified,
    sources: build.sources
  };
}

function findBuild(id) {
  const build = builds.builds.find((candidate) => candidate.id === id);
  if (!build) throw new Error(`Missing build fixture ${id}.`);
  return build;
}

function allSelections(result) {
  if (!result.composition) return [];
  return [
    ...result.composition.aspects.selections,
    ...result.composition.fragments.selections,
    ...(result.composition.setBonus.selection ? [result.composition.setBonus.selection] : []),
    ...result.composition.artifactPerks.selections
  ];
}

function assertComposedResult(result, catalogueById) {
  if (result.origin !== 'engine-composed') {
    throw new Error('Composed result is missing origin: engine-composed.');
  }
  if (result.verified !== false) {
    throw new Error('An engine-composed build must never be verified true.');
  }
  if (!result.claim.includes('not been play-tested')) {
    throw new Error('Composed result is missing the untested-combination statement.');
  }

  const selections = allSelections(result);
  for (const selection of selections) {
    const component = catalogueById.get(selection.componentId);
    if (!component || component.verified !== true) {
      throw new Error(`Selection ${selection.componentId} is missing or unverified.`);
    }
    if (typeof component.effect !== 'string' || component.effect.trim().length === 0) {
      throw new Error(`Selection ${selection.componentId} has an empty effect.`);
    }
    if (!Array.isArray(selection.reasons) || selection.reasons.length === 0) {
      throw new Error(`Selection ${selection.componentId} has no traceable reason.`);
    }

    for (const reason of selection.reasons) {
      if (!reason.ruleCode || !Number.isInteger(reason.rulePriority)) {
        throw new Error(`Selection ${selection.componentId} has an incomplete rule trace.`);
      }
      if (!Array.isArray(reason.matchedKeywords) || reason.matchedKeywords.length === 0) {
        throw new Error(`Selection ${selection.componentId} has no matched keywords.`);
      }
      if (!Array.isArray(reason.supportingComponentIds) || reason.supportingComponentIds.length < 2) {
        throw new Error(`Selection ${selection.componentId} has incomplete supporting IDs.`);
      }
      if (!Array.isArray(reason.sourceRefs) || reason.sourceRefs.length === 0) {
        throw new Error(`Selection ${selection.componentId} has no source refs.`);
      }
    }

    for (let index = 1; index < selection.reasons.length; index += 1) {
      if (selection.reasons[index - 1].rulePriority > selection.reasons[index].rulePriority) {
        throw new Error(`Selection ${selection.componentId} reasons are not priority ordered.`);
      }
    }
  }

  const fragments = result.composition.fragments;
  if (fragments.fragmentSlotsUsed > fragments.fragmentSlotLimit) {
    throw new Error('Composer exceeded the fragment slot limit.');
  }
  for (const fragment of fragments.selections) {
    if (!Array.isArray(fragment.statModifiers)) {
      throw new Error(`Fragment ${fragment.componentId} is missing statModifiers.`);
    }
  }
}

function assertRejectedResult(result) {
  if (result.status !== 'unavailable') {
    throw new Error('Unverified Exotic anchor should be unavailable.');
  }
  if (result.verified !== false || result.origin !== 'engine-composed') {
    throw new Error('Rejected composition has invalid status metadata.');
  }
  if (!result.errors.some((error) => error.includes('not source-verified'))) {
    throw new Error('Rejected composition did not explain the Exotic verification failure.');
  }
}

const catalogueById = new Map(
  catalogue.components.map((component) => [component.id, component])
);

const demoInputs = [
  findBuild('warlock-void-skull-nova-control'),
  findBuild('hunter-solar-wormhusk-team-cure'),
  findBuild('titan-solar-hallowfire-ignition-engine')
];

const results = demoInputs.map((build) => ({
  class: build.class,
  exotic: build.exoticArmor.name,
  result: composeBuildFromExotic({
    exotic: exoticFromBuild(build),
    catalogue
  })
}));

assertComposedResult(results[0].result, catalogueById);
assertComposedResult(results[1].result, catalogueById);
assertRejectedResult(results[2].result);

console.log(JSON.stringify({
  demoStatus: {
    Warlock: results[0].result.status,
    Hunter: results[1].result.status,
    Titan: 'unavailable because the current Hallowfire Heart anchor is unverified'
  },
  results
}, null, 2));
