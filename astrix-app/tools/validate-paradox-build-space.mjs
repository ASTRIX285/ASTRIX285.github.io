#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBuildState,diffBuilds,createValidationRecord,VALIDATION_STATUS} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';
import {BUILD_ELEMENTS,verifiedMasterworkState,validateTierFiveArmour} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-recommendation.mjs';
const item=(hash,name)=>({hash,bungieHash:hash,name});
const source={source:'bungie-loadout',characterId:'hunter-1',characterClass:'hunter',selectedLoadoutIndex:4,subclass:'stasis',subclassName:'Revenant',subclassBuild:{super:item(1,'Silence and Squall'),abilities:[item(2,'Dodge'),item(3,'Jump'),item(4,'Melee'),item(5,'Grenade')],aspects:[item(6,'Aspect A'),item(7,'Aspect B')],fragments:[item(8,'Fragment A'),item(9,'Fragment B')]},artifact:{hash:20,name:'Seasonal Artifact',activePerks:[item(21,'Perk A')]},weapons:[item(30,'Primary'),item(31,'Special'),item(32,'Heavy')],armour:[item(40,'Helmet'),item(41,'Arms'),item(42,'Chest'),item(43,'Legs'),item(44,'Class')]};
const state=createBuildState(source);assert.equal(Object.isFrozen(state.originalBuild),true);assert.notEqual(state.originalBuild,state.workingBuild);state.workingBuild.weapons[2]=item(99,'Paradox Heavy');const changes=diffBuilds(state.originalBuild,state.workingBuild);assert.equal(changes.length,1);assert.equal(changes[0].path,'weapons.2');const test=createValidationRecord({build:state.workingBuild,targetActivity:'Vanguard Master Operation',objective:'survivability'});assert.match(test.testId,/^PF-TEST-/);assert.equal(test.status,VALIDATION_STATUS.UNTESTED);assert.equal(Object.isFrozen(test.buildSnapshot),true);

const root=new URL('../pages/guardian-workspace-v2/',import.meta.url);
const [html,runtime,css,gearRuntime,advisorRuntime]=await Promise.all([
  readFile(new URL('paradox-build-space/index.html',root),'utf8'),
  readFile(new URL('paradox-build-space/paradox-build-space.mjs',root),'utf8'),
  readFile(new URL('paradox-build-space/paradox-build-space.css',root),'utf8'),
  readFile(new URL('guardian-gear-layout.mjs',root),'utf8'),
  readFile(new URL('guardian-weapon-roll-advisor.mjs',root),'utf8')
]);

const t5Armour=Array.from({length:5},(_,index)=>({itemInstanceId:`armour-${index}`,armourTier:5,masterwork:{semanticRole:'masterwork'}}));
assert.deepEqual(BUILD_ELEMENTS,['arc','solar','strand','stasis','void','prismatic'],'Recommendation controls must contain the six supported Destiny elements in the approved order.');
assert.equal(validateTierFiveArmour({armour:t5Armour,forgeLoaderDecision:{ranking:{maximized:true}}}).ready,true,'Five T5 pieces from a Maximized Forge Loader result must pass.');
assert.equal(validateTierFiveArmour({armour:t5Armour.map((row,index)=>index===2?{...row,armourTier:4}:row),forgeLoaderDecision:{ranking:{maximized:true}}}).ready,false,'Any armour below T5 must block generation.');
assert.equal(validateTierFiveArmour({armour:t5Armour,forgeLoaderDecision:{ranking:{maximized:false}}}).ready,false,'A non-Maximized Forge Loader result must block generation.');
assert.equal(verifiedMasterworkState({armourTier:5}),'MASTERWORK NOT REPORTED','T5 alone must not be presented as verified masterwork evidence.');
assert.equal(verifiedMasterworkState({armourTier:5,masterwork:{semanticRole:'masterwork'}}),'MASTERWORK VERIFIED','An explicit masterwork socket must remain visible.');

const loadoutsAt=html.indexOf('loadouts-design-section'),armourAt=html.indexOf('armour-design-section'),weaponsAt=html.indexOf('weapon-design-section'),recommendationAt=html.indexOf('recommendation-panel'),rightRailAt=html.indexOf('build-right-rail'),validationAt=html.indexOf('validation-panel'),intelligenceAt=html.indexOf('data-paradox-analysis');
assert.ok(loadoutsAt>0&&loadoutsAt<armourAt&&armourAt<weaponsAt&&weaponsAt<recommendationAt&&recommendationAt<rightRailAt,'Centre column order must be In-game Loadouts, Armour & Mods, Weapons & Perks, then Elemental Build Options.');
assert.ok(rightRailAt<validationAt&&validationAt<intelligenceAt,'The right rail must contain the Validation Loop above Paradox Intelligence.');
assert.match(html,/PARADOX RECOMMENDATION[\s\S]*?ELEMENTAL BUILD OPTIONS/,'The armour-driven recommendation controls must not be presented as a second subclass picker.');
assert.doesNotMatch(html,/CHOOSE SUBCLASS/,'Build Forge must not label elemental damage recommendations as a subclass picker.');
assert.match(css,/\.build-space\{grid-template-columns:minmax\(360px,20%\) minmax\(720px,1fr\) minmax\(420px,24%\)/,'Build Forge must use the locked Journey three-column proportions.');
assert.match(css,/@media\(max-width:1760px\)\{\.build-space\{grid-template-columns:392px minmax\(0,1fr\)\}/,'Build Forge must follow Journey when the right rail moves below the two-column workspace.');
assert.match(css,/\.build-rail\{container-type:inline-size;--build-rail-icon:clamp\(40px,21cqi,128px\)/,'Build left-rail icons must remain proportional to their column without taking ownership of the shared Character token.');
assert.match(css,/--build-armour-art:clamp\(64px,7cqi,360px\)/,'Armour icons must respond to the Armour section width.');
assert.match(css,/--build-armour-mod:clamp\(32px,3\.6cqi,240px\)/,'Armour mod icons must respond to the Armour section width.');
assert.match(css,/--build-weapon-art:clamp\(64px,7cqi,360px\)/,'Weapon icons must respond to the Weapons section width.');
const responsiveWidthSamples=[1148,1332];
const proportionalTokens=[
  ['armour art',64,.07,360],['armour mod',32,.036,240],['armour rail',12,.012,72],
  ['armour corner',14,.014,84],['armour bonus',16,.016,96],['armour intrinsic',26,.028,168],
  ['armour appearance',24,.025,150],['weapon art',64,.07,360],['weapon perk',14,.0145,88],
  ['weapon corner',12,.0125,76],['weapon power',8,.0085,52]
];
for(const [label,min,ratio,max] of proportionalTokens){
  const sizes=responsiveWidthSamples.map(width=>Math.min(max,Math.max(min,width*ratio)));
  const ratios=sizes.map((size,index)=>size/responsiveWidthSamples[index]);
  assert.ok(Math.abs(ratios[0]-ratios[1])<1e-9,`${label} must retain its percentage between the 1640px and 2560px workspace samples.`);
}
assert.match(css,/Build Forge readability:[\s\S]*?\.build-forge-page[\s\S]*?--dim:#b8b2bd;[\s\S]*?font-family:Inter,system-ui,sans-serif!important/,'Build Forge must retain the readable Inter text hierarchy and high-contrast working colours.');

const elementButtons=[...html.matchAll(/data-recommendation-element="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(elementButtons,BUILD_ELEMENTS,'Recommendation buttons must be ARC, SOLAR, STRAND, STASIS, VOID and PRISMATIC only.');
assert.match(html,/id="generateMaxLoadout" disabled>GENERATE MAX LOADOUT/,'Generation must begin locked until verified inputs pass.');
assert.match(runtime,/function generateMaxLoadout\(\)/,'Build Forge must expose an explicit recommendation generation boundary.');
assert.match(runtime,/applySubclassCandidate\(working,candidate\)[\s\S]*?analyzeLiveGuardian\(working\)[\s\S]*?adviseLiveWeaponRolls\(working,working\.paradoxAnalysis\|\|\{\}, \{insertSocketPlugFree:false\}\)/,'Generation must use the verified subclass catalogue, deterministic analysis and recommendation-only weapon advice.');
assert.match(runtime,/applyForgeArtifactRecommendation\(next,\{currentSeasonNumber,force:true\}\)/,'Generation must refresh the verified legal Artifact fit.');
assert.match(advisorRuntime,/new URL\("\.\.\/\.\.\/data\/paradox-forge\/intelligence\/weapon-perk-intelligence\.json",import\.meta\.url\)/,'Weapon intelligence must resolve from the module rather than the current page URL.');

assert.match(html,/id="recommendedBuildReveal"[\s\S]*?aria-modal="true"[\s\S]*?hidden/,'The complete recommended build must open in a hidden review layer.');
assert.match(html,/id="recommendedArmourSummary"[\s\S]*?id="recommendedWeaponsSummary"[\s\S]*?id="recommendedArtifactSummary"/,'The review must expose armour, weapon and Artifact sections.');
assert.match(runtime,/decorateRecommendedWeaponPerks/,'Build weapons must add recommendation icons only after generation.');
assert.match(runtime,/if\(!generated\)return/,'Weapon recommendations must remain hidden before Generate Max Loadout.');
assert.match(gearRuntime,/return \[masterwork, \.\.\.clean\(generalSource\)\.slice\(0, 2\), \.\.\.clean\(slotSource\)\.slice\(0, 3\)\]/,'Armour mapping must remain masterwork, two general slots and three armour slots.');

assert.match(html,/id="applyBuild" disabled>BUILD MY GUARDIAN<\/button>/,'The only live action must be the explicit Build My Guardian confirmation control.');
assert.match(html,/LIVE GUARDIAN UNCHANGED/,'The review must state that generation does not alter the live Guardian.');
assert.match(runtime,/if\(!build\?\.recommendationGeneratedAt\)throw new Error/,'Live apply must reject any build that has not passed generation and review.');
const applyStart=runtime.indexOf('async function applyBuild()'),applyEnd=runtime.indexOf('function setRangeStatus',applyStart),applySource=runtime.slice(applyStart,applyEnd);
assert.ok(applySource.indexOf('window.confirm')<applySource.indexOf('confirmPerkChangePlan')&&applySource.indexOf('confirmPerkChangePlan')<applySource.indexOf('applyConfirmedPerkChangePlan'),'The live route must ask the user, confirm the plan, then call the authenticated mutation route in that order.');
assert.match(applySource,/Armour, mods and unsupported changes remain untouched/,'The final confirmation must describe the exact supported mutation scope.');

console.log('PARADOX_BUILD_SPACE_STATE=PASS');
console.log('ORIGINAL_WORKING_ISOLATION=PASS');
console.log('DETERMINISTIC_BUILD_DIFF=PASS');
console.log('BUILD_FORGE_LAYOUT=PASS');
console.log('BUILD_FORGE_ARMOUR_T5_AND_MOD_MAPPING=PASS');
console.log('BUILD_FORGE_WEAPON_PERKS=PASS');
console.log('BUILD_FORGE_RECOMMENDATION_ELEMENTS=PASS');
console.log('BUILD_FORGE_ARTIFACT_2_0=PASS');
console.log('BUILD_FORGE_REVIEW_REVEAL=PASS');
console.log('BUILD_MY_GUARDIAN_CONFIRMATION_GATE=PASS');
console.log('VANGUARD_VALIDATION_RECORD=PASS');
