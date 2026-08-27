import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const tools=fileURLToPath(new URL('./',import.meta.url));
const validators=[
  'validate-scope-guard.mjs',
  'validate-main-page-today.mjs',
  'validate-super-formation.mjs',
  'validate-responsive-layout-contract.mjs',
  'validate-destination-theming.mjs',
  'validate-portal-loader.mjs',
  'validate-live-artifact-contract.mjs',
  'validate-paradox-build-space.mjs',
  'validate-guardian-semantics.mjs',
  'validate-weapon-perk-apply.mjs'
];

for(const validator of validators){
  const result=spawnSync(process.execPath,[`${tools}${validator}`],{cwd:fileURLToPath(new URL('../../',import.meta.url)),stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}

console.log('PARADOX_VALIDATOR=PASS');
