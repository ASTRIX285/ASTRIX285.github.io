import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const tools=fileURLToPath(new URL('./',import.meta.url));
const validators=[
  'validate-scope-guard.mjs',
  'validate-guardian-adaptive-layout.py',
  'validate-guardian-character-cards.py',
  'validate-guardian-complete-loadout.py',
  'validate-main-page-today.mjs',
  'validate-super-formation.mjs',
  'validate-responsive-layout-contract.mjs',
  'validate-destination-theming.mjs',
  'validate-portal-loader.mjs',
  'validate-tools-hub.mjs',
  'validate-vault-foundation.mjs',
  'validate-forge-loader.mjs',
  'validate-journey-visual-pass.mjs',
  'validate-public-deep-space.mjs',
  'validate-live-artifact-contract.mjs',
  'validate-manifest-service.mjs',
  'test-manifest-service.mjs',
  'test-build-space-character-isolation.mjs',
  'validate-paradox-build-space.mjs',
  'validate-guardian-semantics.mjs',
  'validate-weapon-perk-apply.mjs',
  'validate-weapon-rolls.mjs'
];

for(const validator of validators){
  const executable=validator.endsWith('.py')?'python3':process.execPath;
  const result=spawnSync(executable,[`${tools}${validator}`],{cwd:fileURLToPath(new URL('../../',import.meta.url)),stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}

console.log('PARADOX_VALIDATOR=PASS');
