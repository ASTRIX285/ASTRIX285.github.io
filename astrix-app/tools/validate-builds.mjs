import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(toolDirectory, '..');
const cataloguePath = path.join(appDirectory, 'data', 'armor-3-builds.json');
const schemaPath = path.join(appDirectory, 'data', 'armor-3-build.schema.json');

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

function loadJson(filePath) {
  return readFile(filePath, 'utf8').then((content) => JSON.parse(content));
}

function formatSchemaError(error) {
  const location = error.instancePath || '/';
  const detail = error.message || 'schema validation failed';
  const parameter = error.params?.missingProperty
    ? ` (${error.params.missingProperty})`
    : '';
  return `${location}: ${detail}${parameter}`;
}

function schemaErrorsByBuild(errors = []) {
  const grouped = new Map();

  for (const error of errors) {
    const match = error.instancePath.match(/^\/builds\/(\d+)(.*)$/);
    const key = match ? Number(match[1]) : 'catalogue';
    const suffix = match ? match[2] || '/' : error.instancePath || '/';
    const normalized = { ...error, instancePath: suffix };

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(formatSchemaError(normalized));
  }

  return grouped;
}

function collectReadinessItems(build) {
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

function collectVerificationGateErrors(build) {
  if (build.verified !== true) return [];

  const errors = collectReadinessItems(build).filter(
    (item) => !item.startsWith('reviewNotes:')
  );

  if (Array.isArray(build.reviewNotes) && build.reviewNotes.length > 0) {
    errors.push('reviewNotes must be empty when verified is true');
  }

  return errors;
}

function printReadinessReport(builds) {
  console.log('\nASTRIX PARADOX build readiness report');
  console.log('====================================');

  for (const build of builds) {
    const items = collectReadinessItems(build);
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

async function main() {
  let catalogue;
  let schema;

  try {
    [catalogue, schema] = await Promise.all([
      loadJson(cataloguePath),
      loadJson(schemaPath)
    ]);
  } catch (error) {
    console.error(`Unable to load validation inputs: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const schemaValid = validate(catalogue);
  const builds = Array.isArray(catalogue.builds) ? catalogue.builds : [];

  let failed = false;

  if (!schemaValid) {
    failed = true;
    console.error('Schema validation failed.');
    const grouped = schemaErrorsByBuild(validate.errors);

    for (const [key, errors] of grouped) {
      if (key === 'catalogue') {
        console.error('\nCatalogue-level errors:');
      } else {
        const build = builds[key];
        const label = build?.name || build?.id || `build index ${key}`;
        console.error(`\n${label}:`);
      }

      for (const error of errors) console.error(`- ${error}`);
    }
  } else {
    console.log(`Schema validation passed for ${builds.length} build record(s).`);
  }

  const gateFailures = builds
    .map((build) => ({ build, errors: collectVerificationGateErrors(build) }))
    .filter(({ errors }) => errors.length > 0);

  if (gateFailures.length > 0) {
    failed = true;
    console.error('\nVerification gate failed.');
    for (const { build, errors } of gateFailures) {
      console.error(`\n${build.name} (${build.id}) is marked verified: true but is incomplete:`);
      for (const error of errors) console.error(`- ${error}`);
    }
  } else {
    console.log('Verification gate passed. No incomplete build is marked verified: true.');
  }

  printReadinessReport(builds);

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
