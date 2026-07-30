import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(toolDirectory, '..');
const buildCataloguePath = path.join(appDirectory, 'data', 'armor-3-builds.json');
const buildSchemaPath = path.join(appDirectory, 'data', 'armor-3-build.schema.json');
const componentCataloguePath = path.join(appDirectory, 'data', 'armor-3-components.json');
const componentSchemaPath = path.join(appDirectory, 'data', 'armor-3-components.schema.json');

const SECTION_FLAGS = [
  ['exoticArmor.verified', (build) => build.exoticArmor?.verified],
  ['armor3.verified', (build) => build.armor3?.verified],
  ['subclassSetup.verified', (build) => build.subclassSetup?.verified],
  ['mods.verified', (build) => build.mods?.verified],
  ['artifact.verified', (build) => build.artifact?.verified],
  ['weapons.verified', (build) => build.weapons?.verified]
];

const REQUIRED_COMPLETE_ARRAYS = [
  ['armor3.setBonuses', (build) => build.armor3?.setBonuses],
  ['subclassSetup.fragments', (build) => build.subclassSetup?.fragments],
  ['mods.helmet', (build) => build.mods?.helmet],
  ['mods.arms', (build) => build.mods?.arms],
  ['mods.chest', (build) => build.mods?.chest],
  ['mods.legs', (build) => build.mods?.legs],
  ['mods.classItem', (build) => build.mods?.classItem],
  ['weapons.examples', (build) => build.weapons?.examples]
];

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function loadJson(filePath) {
  return readFile(filePath, 'utf8').then((content) => JSON.parse(content));
}

function formatSchemaError(error) {
  const location = error.instancePath || '/';
  const detail = error.message || 'schema validation failed';
  const parameter = error.params?.missingProperty ? ` (${error.params.missingProperty})` : '';
  return `${location}: ${detail}${parameter}`;
}

function schemaErrorsByRecord(errors = [], collectionName) {
  const grouped = new Map();

  for (const error of errors) {
    const match = error.instancePath.match(new RegExp(`^/${collectionName}/(\\d+)(.*)$`));
    const key = match ? Number(match[1]) : 'catalogue';
    const suffix = match ? match[2] || '/' : error.instancePath || '/';
    const normalized = { ...error, instancePath: suffix };

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(formatSchemaError(normalized));
  }

  return grouped;
}

function collectBuildReadinessItems(build) {
  const items = [];

  for (const [field, read] of SECTION_FLAGS) {
    if (read(build) !== true) items.push(`${field} is false`);
  }

  for (const [field, read] of REQUIRED_COMPLETE_ARRAYS) {
    if (!isNonEmptyArray(read(build))) items.push(`${field} is empty`);
  }

  if (build.artifact?.required === true && !isNonEmptyArray(build.artifact?.perks)) {
    items.push('artifact.perks is empty while artifact.required is true');
  }

  if (!isNonEmptyArray(build.sources)) items.push('sources is empty');
  if (!isNonEmptyArray(build.gameplayLoop)) items.push('gameplayLoop is empty');

  const reviewNotes = Array.isArray(build.reviewNotes) ? build.reviewNotes : [];
  for (const note of reviewNotes) {
    const trimmed = String(note).trim();
    if (trimmed) items.push(`reviewNotes: ${trimmed}`);
  }

  return [...new Set(items)];
}

function collectBuildVerificationGateErrors(build) {
  if (build.verified !== true) return [];

  const errors = collectBuildReadinessItems(build).filter(
    (item) => !item.startsWith('reviewNotes:')
  );

  if (Array.isArray(build.reviewNotes) && build.reviewNotes.length > 0) {
    errors.push('reviewNotes must be empty when verified is true');
  }

  return errors;
}

function collectComponentReadinessItems(component) {
  const items = [];

  if (component.verified !== true) items.push('verified is false');
  if (!isNonEmptyArray(component.sources)) items.push('sources is empty');

  if (component.type === 'setBonus') {
    if (!isNonEmptyText(component.setBonus?.twoPiece?.name)) {
      items.push('setBonus.twoPiece.name is empty');
    }
    if (!isNonEmptyText(component.setBonus?.twoPiece?.effect)) {
      items.push('setBonus.twoPiece.effect is empty');
    }
    if (component.setBonus?.twoPiece?.verified !== true) {
      items.push('setBonus.twoPiece.verified is false');
    }
    if (!isNonEmptyText(component.setBonus?.fourPiece?.name)) {
      items.push('setBonus.fourPiece.name is empty');
    }
    if (!isNonEmptyText(component.setBonus?.fourPiece?.effect)) {
      items.push('setBonus.fourPiece.effect is empty');
    }
    if (component.setBonus?.fourPiece?.verified !== true) {
      items.push('setBonus.fourPiece.verified is false');
    }
  } else if (!isNonEmptyText(component.effect)) {
    items.push('effect is empty');
  }

  return [...new Set(items)];
}

function collectComponentVerificationGateErrors(component) {
  if (component.verified !== true) return [];
  return collectComponentReadinessItems(component).filter((item) => item !== 'verified is false');
}

function printBuildReadinessReport(builds) {
  console.log('\nASTRIX PARADOX build readiness report');
  console.log('====================================');

  for (const build of builds) {
    const items = collectBuildReadinessItems(build);
    console.log(`\n${build.name} (${build.id})`);
    console.log(`Overall verified: ${build.verified === true ? 'true' : 'false'}`);

    if (items.length === 0) {
      console.log('Ready: no outstanding verification items.');
      continue;
    }

    console.log('Still needs in-game confirmation:');
    for (const item of items) console.log(`- ${item}`);
  }
}

function printComponentReadinessReport(catalogue, components) {
  console.log('\nASTRIX PARADOX component readiness report');
  console.log('========================================');
  console.log(`Set-bonus source table available: ${catalogue.seedStatus?.setBonusTableAvailable === true ? 'true' : 'false'}`);

  if (isNonEmptyText(catalogue.seedStatus?.notes)) {
    console.log(`Seed note: ${catalogue.seedStatus.notes}`);
  }

  if (components.length === 0) {
    console.log('\nNo component records are present.');
    console.log('- The names-only set-bonus table is still required before set records can be seeded.');
    console.log('- No names, effects, verification states or sources were invented.');
    return;
  }

  for (const component of components) {
    const items = collectComponentReadinessItems(component);
    console.log(`\n${component.name} (${component.id})`);
    console.log(`Type: ${component.type}`);
    console.log(`Overall verified: ${component.verified === true ? 'true' : 'false'}`);

    if (items.length === 0) {
      console.log('Ready: no outstanding verification items.');
      continue;
    }

    console.log('Still needs verification:');
    for (const item of items) console.log(`- ${item}`);
  }
}

function reportSchemaErrors(label, validate, records, collectionName) {
  console.error(`${label} schema validation failed.`);
  const grouped = schemaErrorsByRecord(validate.errors, collectionName);

  for (const [key, errors] of grouped) {
    if (key === 'catalogue') {
      console.error('\nCatalogue-level errors:');
    } else {
      const record = records[key];
      const recordLabel = record?.name || record?.id || `${collectionName} index ${key}`;
      console.error(`\n${recordLabel}:`);
    }

    for (const error of errors) console.error(`- ${error}`);
  }
}

async function main() {
  let buildCatalogue;
  let buildSchema;
  let componentCatalogue;
  let componentSchema;

  try {
    [buildCatalogue, buildSchema, componentCatalogue, componentSchema] = await Promise.all([
      loadJson(buildCataloguePath),
      loadJson(buildSchemaPath),
      loadJson(componentCataloguePath),
      loadJson(componentSchemaPath)
    ]);
  } catch (error) {
    console.error(`Unable to load validation inputs: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  const validateBuilds = ajv.compile(buildSchema);
  const validateComponents = ajv.compile(componentSchema);
  const buildSchemaValid = validateBuilds(buildCatalogue);
  const componentSchemaValid = validateComponents(componentCatalogue);
  const builds = Array.isArray(buildCatalogue.builds) ? buildCatalogue.builds : [];
  const components = Array.isArray(componentCatalogue.components) ? componentCatalogue.components : [];

  let failed = false;

  if (!buildSchemaValid) {
    failed = true;
    reportSchemaErrors('Build', validateBuilds, builds, 'builds');
  } else {
    console.log(`Build schema validation passed for ${builds.length} build record(s).`);
  }

  if (!componentSchemaValid) {
    failed = true;
    reportSchemaErrors('Component', validateComponents, components, 'components');
  } else {
    console.log(`Component schema validation passed for ${components.length} component record(s).`);
  }

  const buildGateFailures = builds
    .map((build) => ({ build, errors: collectBuildVerificationGateErrors(build) }))
    .filter(({ errors }) => errors.length > 0);

  if (buildGateFailures.length > 0) {
    failed = true;
    console.error('\nBuild verification gate failed.');
    for (const { build, errors } of buildGateFailures) {
      console.error(`\n${build.name} (${build.id}) is marked verified: true but is incomplete:`);
      for (const error of errors) console.error(`- ${error}`);
    }
  } else {
    console.log('Build verification gate passed. No incomplete build is marked verified: true.');
  }

  const componentGateFailures = components
    .map((component) => ({ component, errors: collectComponentVerificationGateErrors(component) }))
    .filter(({ errors }) => errors.length > 0);

  if (componentGateFailures.length > 0) {
    failed = true;
    console.error('\nComponent verification gate failed.');
    for (const { component, errors } of componentGateFailures) {
      console.error(`\n${component.name} (${component.id}) is marked verified: true but is incomplete:`);
      for (const error of errors) console.error(`- ${error}`);
    }
  } else {
    console.log('Component verification gate passed. No incomplete component is marked verified: true.');
  }

  printBuildReadinessReport(builds);
  printComponentReadinessReport(componentCatalogue, components);

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
