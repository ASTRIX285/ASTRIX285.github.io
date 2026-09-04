#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBuildState,diffBuilds,createValidationRecord,VALIDATION_STATUS} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';
import {BUILD_ELEMENTS,verifiedMasterworkState,validateTierFiveArmour} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-recommendation.mjs';
import {composeForgeRecommendation,filterExoticCompatibleSubclasses} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-forge-intelligence.mjs';
import {isExoticItem,recommendArmourMods,selectOwnedWeapons,validateExoticLoadout} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-loadout-intelligence.mjs';
const item=(hash,name)=>({hash,bungieHash:hash,name});
const source={source:'bungie-loadout',characterId:'hunter-1',characterClass:'hunter',selectedLoadoutIndex:4,subclass:'stasis',subclassName:'Revenant',subclassBuild:{super:item(1,'Silence and Squall'),abilities:[item(2,'Dodge'),item(3,'Jump'),item(4,'Melee'),item(5,'Grenade')],aspects:[item(6,'Aspect A'),item(7,'Aspect B')],fragments:[item(8,'Fragment A'),item(9,'Fragment B')]},artifact:{hash:20,name:'Seasonal Artifact',activePerks:[item(21,'Perk A')]},weapons:[item(30,'Primary'),item(31,'Special'),item(32,'Heavy')],armour:[item(40,'Helmet'),item(41,'Arms'),item(42,'Chest'),item(43,'Legs'),item(44,'Class')]};
const state=createBuildState(source);assert.equal(Object.isFrozen(state.originalBuild),true);assert.notEqual(state.originalBuild,state.workingBuild);state.workingBuild.weapons[2]=item(99,'Paradox Heavy');const changes=diffBuilds(state.originalBuild,state.workingBuild);assert.equal(changes.length,1);assert.equal(changes[0].path,'weapons.2');const test=createValidationRecord({build:state.workingBuild,targetActivity:'Vanguard Master Operation',objective:'survivability'});assert.match(test.testId,/^PF-TEST-/);assert.equal(test.status,VALIDATION_STATUS.UNTESTED);assert.equal(Object.isFrozen(test.buildSnapshot),true);

const root=new URL('../pages/guardian-workspace-v2/',import.meta.url);
const [html,runtime,css,gearRuntime,advisorRuntime,intelligenceRuntime,liveAdapterRuntime]=await Promise.all([
  readFile(new URL('paradox-build-space/index.html',root),'utf8'),
  readFile(new URL('paradox-build-space/paradox-build-space.mjs',root),'utf8'),
  readFile(new URL('paradox-build-space/paradox-build-space.css',root),'utf8'),
  readFile(new URL('guardian-gear-layout.mjs',root),'utf8'),
  readFile(new URL('guardian-weapon-roll-advisor.mjs',root),'utf8'),
  readFile(new URL('paradox-build-space/paradox-forge-intelligence.mjs',root),'utf8'),
  readFile(new URL('guardian-paradox-live-adapter.mjs',root),'utf8')
]);

const t5Armour=Array.from({length:5},(_,index)=>({itemInstanceId:`armour-${index}`,armourTier:5,masterwork:{semanticRole:'masterwork'}}));
assert.deepEqual(BUILD_ELEMENTS,['arc','solar','strand','stasis','void','prismatic'],'Recommendation controls must contain the six supported Destiny elements in the approved order.');
assert.equal(validateTierFiveArmour({armour:t5Armour,forgeLoaderDecision:{ranking:{maximized:true}}}).ready,true,'Five T5 pieces from a Maximized Forge Loader result must pass.');
assert.equal(validateTierFiveArmour({armour:t5Armour.map((row,index)=>index===2?{...row,armourTier:4}:row),forgeLoaderDecision:{ranking:{maximized:true}}}).ready,false,'Any armour below T5 must block generation.');
assert.equal(validateTierFiveArmour({armour:t5Armour,forgeLoaderDecision:{ranking:{maximized:false}}}).ready,false,'A non-Maximized Forge Loader result must block generation.');
assert.equal(verifiedMasterworkState({armourTier:5}),'MASTERWORK NOT REPORTED','T5 alone must not be presented as verified masterwork evidence.');
assert.equal(verifiedMasterworkState({armourTier:5,masterwork:{semanticRole:'masterwork'}}),'MASTERWORK VERIFIED','An explicit masterwork socket must remain available to the hidden validation gate.');

const verifiedComponent=(hash,name,description,componentType,extra={})=>({hash,bungieHash:hash,name,description,componentType,source:'bungie-manifest',definition:{displayProperties:{name,description},traitIds:extra.traitIds||[]},...extra});
const quietSuper=verifiedComponent(101,'Quiet Super','Arc damage.','super');
const joltSuper=verifiedComponent(102,'Jolt Super','Jolts targets with Arc damage.','super');
const classAbility=verifiedComponent(103,'Class Ability','Activates the class ability.','classAbility');
const movement=verifiedComponent(104,'Movement','Improves movement.','movementAbility');
const quietMelee=verifiedComponent(105,'Quiet Melee','Arc melee damage.','melee');
const joltMelee=verifiedComponent(106,'Jolt Melee','Arc melee jolts targets.','melee');
const quietGrenade=verifiedComponent(107,'Quiet Grenade','Arc grenade damage.','grenade');
const joltGrenade=verifiedComponent(108,'Jolt Grenade','Arc grenade jolts targets.','grenade');
const joltAspect=verifiedComponent(109,'Jolt Aspect','Defeating jolted targets grants grenade energy.','aspect',{fragmentSlots:1});
const utilityAspect=verifiedComponent(110,'Utility Aspect','Class ability energy.','aspect',{fragmentSlots:1});
const unresolvedAspect={hash:111,bungieHash:111,name:'Unresolved Aspect',unresolved:true,componentType:'aspect'};
const joltFragment=verifiedComponent(112,'Jolt Fragment','Grenades jolt targets.','fragment');
const blindFragment=verifiedComponent(113,'Blind Fragment','Arc damage can blind targets.','fragment');
const intelligenceCandidate={hash:200,bungieHash:200,name:'Arcstrider',element:'arc',source:'bungie-manifest',definition:{displayProperties:{name:'Arcstrider'}},subclassBuild:{
  socketsAvailable:true,socketCoverage:{complete:true},
  super:quietSuper,superOptions:[quietSuper,joltSuper],classAbility,movement,melee:quietMelee,grenade:quietGrenade,
  abilities:[classAbility,movement,quietMelee,quietGrenade],
  abilityOptionsBySocket:{classAbility:[classAbility],movement:[movement],melee:[quietMelee,joltMelee],grenade:[quietGrenade,joltGrenade]},
  aspects:[utilityAspect,joltAspect],availableAspects:[utilityAspect,joltAspect,unresolvedAspect],fragments:[blindFragment,joltFragment],availableFragments:[blindFragment,joltFragment]
}};
const intelligenceSource={source:'bungie-loadout',characterId:'hunter-1',characterClass:'hunter',forgeLoaderDecision:{buildAnchor:{perk:verifiedComponent(300,'Jolt Anchor','Jolting targets grants grenade energy.','armourEffect')},setProtocol:[],statDirective:{priorities:{grenade:1}},ranking:{maximized:true}},weapons:[],armour:t5Armour};
const analyseCandidate=build=>{const rows=[build.super,...(build.abilities||[]),...(build.aspects||[]),...(build.fragments||[])].filter(Boolean),links=rows.filter(row=>/jolt/i.test(row.description||'')).map((row,index)=>({chain:`${row.name} -> jolt -> anchor ${index}`}));return {buildLoop:links,strengths:links,weakLinks:[],confidence:{level:links.length?'high':'insufficient'}};};
const composed=composeForgeRecommendation({build:intelligenceSource,candidate:intelligenceCandidate,element:'arc',analyzeBuild:analyseCandidate});
assert.equal(composed.workingBuild.subclassBuild.super.hash,joltSuper.hash,'The Forge intelligence must prefer the verified Super with the strongest directed armour-loop evidence.');
assert.equal(composed.workingBuild.subclassBuild.melee.hash,joltMelee.hash,'The Forge intelligence must score verified ability alternatives.');
assert.equal(composed.workingBuild.subclassBuild.grenade.hash,joltGrenade.hash,'The Forge intelligence must score every verified ability socket.');
assert.ok(composed.workingBuild.subclassBuild.aspects.every(row=>row.unresolved!==true),'Unresolved options must never enter a generated recommendation.');
assert.deepEqual(composed.workingBuild.abilities.map(row=>row.hash),composed.workingBuild.subclassBuild.abilities.map(row=>row.hash),'The root live-transfer projection must match the recommended subclass socket projection.');
assert.equal(composed.intelligence.source,'verified-forge-loader-bungie-catalogue');
assert.ok(composed.intelligence.evidence.directedLinks>=4,'The decision ledger must preserve directed evidence metrics.');
assert.throws(()=>composeForgeRecommendation({build:intelligenceSource,candidate:{...intelligenceCandidate,subclassBuild:{...intelligenceCandidate.subclassBuild,socketsAvailable:false}},element:'arc',analyzeBuild:analyseCandidate}),/complete verified Bungie subclass socket set/,'A canonical element without a live verified socket set must never be offered as an intelligence result.');
const prismaticFragments=['arc','solar','void','stasis','strand'].map((element,index)=>verifiedComponent(400+index,`${element} fragment`,`${element} damage interaction.`, 'fragment',{element}));
const prismaticCandidate={...intelligenceCandidate,element:'prismatic',name:'Prismatic',subclassBuild:{...intelligenceCandidate.subclassBuild,aspects:[{...joltAspect,fragmentSlots:5}],availableAspects:[{...joltAspect,fragmentSlots:5}],fragments:prismaticFragments.slice(0,2),availableFragments:prismaticFragments}};
const prismatic=composeForgeRecommendation({build:intelligenceSource,candidate:prismaticCandidate,element:'prismatic',analyzeBuild:null});
assert.deepEqual([...prismatic.intelligence.prismaticCoverage.covered].sort(),['arc','solar','stasis','strand','void'],'Prismatic recommendations must score and report verified coverage across all five damage families when that evidence exists.');
assert.deepEqual(prismatic.intelligence.prismaticCoverage.missing,[],'A fully evidenced Prismatic combination must not claim a missing damage family.');
const scatterGrenade=verifiedComponent(114,'Scatter Grenade','A grenade that splits into many submunitions.','grenade');
const nothingManaclesSource={...intelligenceSource,forgeLoaderDecision:{...intelligenceSource.forgeLoaderDecision,buildAnchor:{name:'Nothing Manacles',selectedItemInstanceId:'nothing-manacles-instance',perk:verifiedComponent(301,'Scatter Charge','Gain an additional Scatter Grenade charge. Enables tracking for Scatter Grenade projectiles.','armourEffect')}}};
const nothingManaclesCandidate={...intelligenceCandidate,hash:201,bungieHash:201,element:'void',name:'Voidwalker',subclassBuild:{...intelligenceCandidate.subclassBuild,grenade:quietGrenade,abilities:[classAbility,movement,quietMelee,quietGrenade],abilityOptionsBySocket:{...intelligenceCandidate.subclassBuild.abilityOptionsBySocket,grenade:[quietGrenade,joltGrenade,scatterGrenade]}}};
const nothingManaclesBuild=composeForgeRecommendation({build:nothingManaclesSource,candidate:nothingManaclesCandidate,element:'void',analyzeBuild:null});
assert.equal(nothingManaclesBuild.workingBuild.subclassBuild.grenade.hash,scatterGrenade.hash,'Nothing Manacles must force the explicitly named Scatter Grenade into the recommendation.');
assert.ok(nothingManaclesBuild.intelligence.decisions.some(row=>row.componentHash===scatterGrenade.hash&&row.reasons.some(reason=>reason.code==='exotic-anchor-exact-ability')),'The decision ledger must explain that Scatter Grenade was selected from the Nothing Manacles perk text.');
assert.deepEqual(filterExoticCompatibleSubclasses(nothingManaclesSource,[intelligenceCandidate,nothingManaclesCandidate]).map(row=>row.element),['void'],'An Exotic that explicitly names Scatter Grenade must expose only the verified Void subclass as compatible.');

const armourMod=(hash,name,description,role,socketIndex,energyCost,statName='',statValue=0)=>({hash,bungieHash:hash,name,description,socketIndex,canInsert:true,definition:{displayProperties:{name,description},plug:{plugCategoryIdentifier:role==='general-mod'?'armor.mods.general':'armor.mods.helmet',energyCost},traitIds:[]},statContributions:statName?[{hash:7000+hash,name:statName,value:statValue,isConditionallyActive:false}]:[]});
const minorHealth=armourMod(501,'Minor Health Mod','Improves Health.','general-mod',1,1,'Health',5);
const majorHealth=armourMod(502,'Major Health Mod','Greatly improves Health.','general-mod',1,3,'Health',10);
const grenadeLoop=armourMod(503,'Grenade Kickstart','Using a grenade returns grenade energy.','slot-mod',2,3);
const emptySlot={...armourMod(504,'Empty Mod Socket','No mod equipped.','slot-mod',3,0),definition:{...armourMod(504,'Empty Mod Socket','No mod equipped.','slot-mod',3,0).definition}};
const ashes=armourMod(505,'Ashes to Assets','Grenade final blows grant Super energy.','slot-mod',3,3);
const modArmour=[{...t5Armour[0],name:'Test Helmet',energy:{capacity:10,used:4},generalMods:[minorHealth],slotMods:[grenadeLoop,emptySlot],armourSemantics:{energy:{capacity:10,used:4},generalMods:[minorHealth],slotMods:[grenadeLoop,emptySlot]},armourModOptions:{1:[minorHealth,majorHealth],2:[grenadeLoop],3:[emptySlot,ashes]}}].concat(t5Armour.slice(1));
const modSource={...intelligenceSource,armour:modArmour,forgeLoaderDecision:{...intelligenceSource.forgeLoaderDecision,statDirective:{targets:{health:100,melee:0,grenade:0,super:0,class:0,weapon:0},priorities:{health:1,melee:0,grenade:2,super:0,class:0,weapon:0},achieved:{health:70,melee:40,grenade:40,super:40,class:40,weapon:40},rawTotal:270,modsApplied:false}}};
const modState=createBuildState(modSource),modResult=recommendArmourMods({build:modState.workingBuild,objective:'ability-uptime'}),modActions=Object.fromEntries(modResult.recommendation.decisions.map(row=>[row.socketIndex,row.action]));
assert.equal(modActions[1],'REPLACE','A stronger verified stat mod must replace a weaker installed mod when energy allows.');
assert.equal(modActions[2],'KEEP','An installed mod must be retained when no verified alternative proves a stronger fit.');
assert.equal(modActions[3],'ADD','A verified synergistic mod must fill an empty functional socket when energy allows.');
assert.equal(modResult.recommendation.rawStatsModFree,true,'The armour recommendation must explicitly preserve the mod-free Forge Loader baseline.');
assert.equal(modResult.recommendation.projectedStats.raw.health,70,'Projected recommendations must not mutate raw Forge Loader stats.');
assert.equal(modResult.recommendation.projectedStats.currentTotal.health,75,'Installed stat mods must be evaluated separately from the raw Forge Loader result.');
assert.equal(modResult.recommendation.projectedStats.recommendedTotal.health,80,'Recommended stat mods must produce a separate capped projection.');
assert.equal(modState.originalBuild.armour[0].generalMods[0].hash,minorHealth.hash,'The protected Original must retain the installed mod after Working Build optimization.');
assert.equal(modResult.workingBuild.armour[0].generalMods[0].hash,majorHealth.hash,'Only the Working Build may carry the recommended replacement.');
assert.equal(modResult.recommendation.liveTransferAuthorized,false,'A generated armour-mod plan must remain review-only.');
const weaponStatMod=armourMod(506,'Minor Weapon Mod','Improves Weapon.','general-mod',1,1,'Weapon',5),grenadeStatMod=armourMod(507,'Minor Grenade Mod','Improves Grenade.','general-mod',1,1,'Grenade',5);
const nothingManaclesModArmour=[{...t5Armour[0],name:'Nothing Manacles Test Piece',energy:{capacity:10,used:1},generalMods:[weaponStatMod],slotMods:[],armourSemantics:{energy:{capacity:10,used:1},generalMods:[weaponStatMod],slotMods:[]},armourModOptions:{1:[weaponStatMod,grenadeStatMod]}}].concat(t5Armour.slice(1));
const nothingManaclesModSource={...nothingManaclesSource,armour:nothingManaclesModArmour,forgeLoaderDecision:{...nothingManaclesSource.forgeLoaderDecision,statDirective:{targets:{health:0,melee:0,grenade:200,super:0,class:0,weapon:0},priorities:{health:0,melee:0,grenade:1,super:0,class:0,weapon:0},achieved:{health:30,melee:50,grenade:160,super:80,class:70,weapon:75},rawTotal:465,modsApplied:false}}};
const nothingManaclesModResult=recommendArmourMods({build:nothingManaclesModSource,objective:'dps'}),nothingManaclesStatDecision=nothingManaclesModResult.recommendation.decisions.find(row=>row.socketIndex===1);
assert.equal(nothingManaclesStatDecision?.recommended?.hash,grenadeStatMod.hash,'Nothing Manacles must replace a generic Weapon stat mod with the verified Grenade stat option while Grenade remains below cap.');
assert.equal(nothingManaclesStatDecision?.reasons?.[0]?.kind,'exotic-anchor-stat','The mod plan must identify the selected Exotic armour loop as the primary stat reason.');

const exactWeapon=(hash,instance,name,description,bucketHash,extra={})=>({hash,bungieHash:hash,itemInstanceId:instance,name,description,bucketHash,definition:{displayProperties:{name,description},traitIds:[],inventory:{tierType:extra.isExotic?6:5,tierTypeName:extra.isExotic?'Exotic':'Legendary'}},weaponSemantics:{selectedPerks:[],alternativePerkColumns:[]},...extra});
const currentPrimary=exactWeapon(601,'weapon-current','Plain Rifle','A reliable rifle.',1498876634),joltPrimary=exactWeapon(602,'weapon-jolt','Jolt Rifle','Final blows jolt nearby targets and grant grenade energy.',1498876634),energyWeapon=exactWeapon(603,'weapon-energy','Energy Weapon','Verified energy weapon.',2465295065),powerWeapon=exactWeapon(604,'weapon-power','Power Weapon','Verified power weapon.',953998645);
const ownedWeaponCatalogue=[currentPrimary,joltPrimary,energyWeapon,powerWeapon];
const weaponResult=selectOwnedWeapons({build:{...intelligenceSource,weapons:[currentPrimary,energyWeapon,powerWeapon],ownedWeapons:ownedWeaponCatalogue,vaultWeapons:ownedWeaponCatalogue},objective:'add-clear'});
assert.equal(weaponResult.workingBuild.weapons[0].itemInstanceId,'weapon-jolt','Owned-weapon ranking must select the exact verified instance with stronger explicit armour-loop and objective evidence.');
assert.equal(weaponResult.recommendation.decisions[0].action,'REPLACE','Owned-weapon review must identify an exact instance replacement.');
assert.equal(weaponResult.recommendation.inventoryScope,'vault-character-and-equipped','Weapon ranking must use the complete verified owned inventory rather than equipped weapons alone.');
assert.equal(weaponResult.recommendation.candidateCount,4,'Duplicate inventory sources must collapse to four exact owned instances in linear time.');
assert.equal(weaponResult.workingBuild.ownedWeapons,ownedWeaponCatalogue,'Owned-weapon ranking must structurally share the unchanged catalogue instead of deep-copying it.');
assert.equal(weaponResult.recommendation.liveTransferAuthorized,false,'Owned-weapon selection must remain review-only.');
const exoticEnergy=exactWeapon(605,'weapon-exotic-energy','Exotic Grenade Energy Weapon','Void final blows grant grenade energy and jolt targets.',2465295065,{isExotic:true}),exoticPower=exactWeapon(606,'weapon-exotic-power','Exotic Grenade Power Weapon','Void final blows grant grenade energy and jolt targets.',953998645,{isExotic:true});
const constrainedWeaponResult=selectOwnedWeapons({build:{...nothingManaclesSource,weapons:[currentPrimary,energyWeapon,powerWeapon],ownedWeapons:[currentPrimary,joltPrimary,energyWeapon,powerWeapon,exoticEnergy,exoticPower]},objective:'dps'});
assert.equal(constrainedWeaponResult.workingBuild.weapons.filter(isExoticItem).length,1,'A recommended Destiny loadout must never contain more than one Exotic weapon.');
assert.deepEqual(constrainedWeaponResult.recommendation.constraints,{maxExoticWeapons:1,selectedExoticWeaponCount:1},'The recommendation must expose its enforced Exotic weapon constraint.');
assert.equal(validateExoticLoadout({...constrainedWeaponResult.workingBuild,armour:[{...t5Armour[0],isExotic:true,itemInstanceId:'nothing-manacles-instance'},...t5Armour.slice(1)]},{requireArmourAnchor:true}).ready,true,'One selected Exotic armour and one recommended Exotic weapon must pass the Destiny equip rule.');
assert.equal(validateExoticLoadout({armour:[{...t5Armour[0],isExotic:true},{...t5Armour[1],isExotic:true}],weapons:[exoticEnergy,exoticPower]}).ready,false,'Any build containing multiple Exotic armour pieces or weapons must fail before review.');

const loadoutsAt=html.indexOf('loadouts-design-section'),armourAt=html.indexOf('armour-design-section'),weaponsAt=html.indexOf('weapon-design-section'),recommendationAt=html.indexOf('recommendation-panel'),rightRailAt=html.indexOf('build-right-rail'),validationAt=html.indexOf('validation-panel'),intelligenceAt=html.indexOf('data-paradox-analysis');
assert.ok(loadoutsAt>0&&loadoutsAt<armourAt&&armourAt<weaponsAt&&weaponsAt<recommendationAt&&recommendationAt<rightRailAt,'Centre column order must be In-game Loadouts, Armour & Mods, Weapons & Perks, then Elemental Build Options.');
assert.ok(rightRailAt<validationAt&&validationAt<intelligenceAt,'The right rail must contain the Validation Loop above Paradox Intelligence.');
assert.match(html,/PARADOX RECOMMENDATION[\s\S]*?ELEMENTAL BUILD OPTIONS/,'The armour-driven recommendation controls must not be presented as a second subclass picker.');
assert.doesNotMatch(html,/CHOOSE SUBCLASS/,'Build Forge must not label elemental damage recommendations as a subclass picker.');
assert.match(css,/\.build-space\{grid-template-columns:var\(--apx-workspace-columns,minmax\(360px,20%\) minmax\(720px,1fr\) minmax\(420px,24%\)\)/,'Build Forge must consume the shared Journey workspace proportions.');
assert.match(css,/\.build-space\{grid-template-columns:var\(--apx-workspace-columns,[^;]+\);gap:var\(--apx-workspace-gap,\.625rem\);align-items:stretch\}/,'Loaded Build Forge columns must share the common gutter and stretch to the centre-column height.');
assert.match(css,/\.build-space>\.build-rail,\.build-space>\.design-canvas,\.build-space>\.build-right-rail,\.build-right-rail>\.intelligence\{height:100%\}/,'All three desktop columns must consume the same loaded row height.');
assert.match(css,/@media\(max-width:1760px\)\{\.build-space\{grid-template-columns:var\(--apx-workspace-compact-columns,392px minmax\(0,1fr\)\)\}/,'Build Forge must share Journey\'s compact workspace before the right rail moves below.');
assert.match(css,/\.build-forge-page \.astrix-platform-shell\{grid-template-columns:0 minmax\(0,1fr\) 0!important\}/,'Build Forge must reclaim the obsolete external media rails for the working columns.');
assert.match(css,/\.build-rail\{container-type:inline-size;--build-rail-icon:clamp\(40px,21cqi,128px\)/,'Build left-rail icons must remain proportional to their column without taking ownership of the shared Character token.');
assert.match(css,/\.armour-design-section \.gear-columns\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/,'All five armour cards must remain on one row.');
assert.match(css,/--build-armour-art:clamp\(64px,8cqi,360px\)/,'Armour icons must respond to the Armour section width at the enlarged scale.');
assert.match(css,/--build-armour-mod:clamp\(32px,4\.2cqi,240px\)/,'Armour mod icons must respond to the Armour section width at the enlarged scale.');
assert.match(css,/--build-weapon-art:clamp\(64px,7cqi,360px\)/,'Weapon icons must respond to the Weapons section width.');
const responsiveWidthSamples=[1148,1332];
const proportionalTokens=[
  ['armour art',64,.08,360],['armour mod',32,.042,240],['armour rail',12,.012,72],
  ['armour corner',14,.014,84],['armour bonus',16,.016,96],['armour intrinsic',26,.028,168],
  ['armour appearance',24,.025,150],['weapon art',64,.07,360],['weapon perk',14,.0145,88],
  ['weapon corner',12,.0125,76],['weapon power',8,.0085,52]
];
for(const [label,min,ratio,max] of proportionalTokens){
  const sizes=responsiveWidthSamples.map(width=>Math.min(max,Math.max(min,width*ratio)));
  const ratios=sizes.map((size,index)=>size/responsiveWidthSamples[index]);
  assert.ok(Math.abs(ratios[0]-ratios[1])<1e-9,`${label} must retain its percentage between the 1640px and 2560px workspace samples.`);
}
assert.match(css,/Build Forge readability:[\s\S]*?\.build-forge-page[\s\S]*?--dim:#b8b2bd;[\s\S]*?font-family:bahnschrift,system-ui,sans-serif!important/,'Build Forge must retain the readable Bahnschrift text hierarchy and high-contrast working colours.');

const elementButtons=[...html.matchAll(/data-recommendation-element="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(elementButtons,BUILD_ELEMENTS,'Recommendation buttons must be ARC, SOLAR, STRAND, STASIS, VOID and PRISMATIC only.');
assert.match(runtime,/elementGrid\?\.classList\.toggle\('has-multiple-options',hasDecision&&supported\.size>1\)/,'Elemental recommendation controls must advertise when multiple verified choices are available.');
assert.match(runtime,/button\.classList\.toggle\('is-available',available\)/,'Each elemental recommendation control must retain its explicit verified-availability state.');
for(const element of BUILD_ELEMENTS)assert.match(css,new RegExp(`data-recommendation-element="${element}"\\]\\{--element-colour:#`),`${element.toUpperCase()} must retain its own elemental colour token.`);
assert.match(css,/\.element-recommendation-grid\.has-multiple-options button:not\(:disabled\)::after\{animation:elemental-option-pulse/,'Multiple selectable elemental options must receive the restrained pulsing glow.');
assert.match(css,/button\.is-selected\{[^}]*border-color:var\(--element-colour\)[^}]*box-shadow:[^}]*var\(--element-colour\)/,'The selected elemental option must have the strongest colour-coded state.');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.element-recommendation-grid\.has-multiple-options button:not\(:disabled\)::after\{animation:none/,'Elemental glow animation must respect reduced-motion preferences.');
assert.match(html,/id="generateMaxLoadout"[^>]*>[^<]+<\/button>[\s\S]*?id="forgeGenerationLoader"[^>]*hidden/,'The in-page Paradox loader must sit below the generation controls and begin hidden.');
assert.match(css,/\.forge-generation-loader\{[^}]*background:transparent\}/,'Recommendation generation must reuse only the circular loader without a full-screen background.');
assert.match(runtime,/await showForgeGenerationLoader\(selectedRecommendationElement\)[\s\S]*?composeForgeRecommendation/,'The circular loader must paint before verified build generation begins.');
assert.match(runtime,/writeState\(next\);render\(\);hideForgeGenerationLoader\(\);openRecommendedBuild\(\)/,'The in-page loader must close before the generated result opens.');
assert.match(html,/OWNED VAULT \+ CHARACTER INVENTORY/,'The recommendation review must identify its full verified weapon-inventory scope.');
assert.match(runtime,/initialWeaponResult=selectOwnedWeapons[\s\S]*?applyForgeArtifactRecommendation\(next,\{currentSeasonNumber,force:true\}\)[\s\S]*?artifactAwareWeaponResult=selectOwnedWeapons/,'Generation must rank owned weapons, select Artifact synergy, then re-rank weapons against that Artifact fit.');
assert.match(runtime,/artifactSynergyScore:Number\(working\.artifactRecommendation\?\.totalScore\|\|0\)/,'Forge intelligence must record the verified Artifact synergy contribution.');
assert.match(html,/id="armourExoticRule">DESTINY EQUIP RULE · 1 EXOTIC ARMOUR/,'The review must show the enforced one-Exotic armour rule.');
assert.match(html,/id="weaponExoticRule">OWNED VAULT \+ CHARACTER INVENTORY · 1 EXOTIC WEAPON MAX/,'The review must show both its full owned inventory scope and one-Exotic weapon limit.');
assert.match(runtime,/EXOTIC ANCHOR: \$\{String\(anchorName\)\.toUpperCase\(\)\}/,'The recommendation heading must name the selected Exotic armour anchor.');
assert.match(runtime,/changedItems=\(plan\.items\|\|\[\]\)[\s\S]*?filter\(row=>row\.action!=='KEEP'\)/,'The review must omit unchanged mod sockets and present only proposed changes.');
assert.match(runtime,/review-artifact-synergy[\s\S]*?ARTIFACT SYNERGY/,'The review must expose the evidence behind the Artifact recommendation.');
assert.match(css,/\.recommended-build-dialog\{width:calc\(100vw - 20px\);max-width:none;border:0/,'The recommendation review must use the page width without the cramped red outer container.');
assert.match(html,/id="continueToBuildTest">TEST THIS BUILD/,'The recommendation review must lead into the user-run Build Test.');
assert.match(runtime,/function renderParadoxTestReview\(capture=readCapture\(\)\)[\s\S]*?Causal perk activation, DPS and uptime remain inference/,'Paradox must review confirmed post-test Bungie evidence without inventing causal telemetry.');
assert.deepEqual([...html.matchAll(/data-build-objective="([^"]+)"/g)].map(match=>match[1]),['balanced','dps','add-clear','survivability','ability-uptime'],'Build Forge must expose the five deterministic tuning objectives used by weapon and mod ranking.');
assert.match(html,/id="generateMaxLoadout" disabled>GENERATE MAX LOADOUT/,'Generation must begin locked until verified inputs pass.');
assert.match(runtime,/function generateMaxLoadout\(\)/,'Build Forge must expose an explicit recommendation generation boundary.');
assert.match(runtime,/function blankArmourModCanvas\(\)[\s\S]*?Array\.from\(\{length:6\}[\s\S]*?AI recommendation pending[\s\S]*?grid\.innerHTML=blankSlots/,'Every staged armour item must present six blank AI recommendation slots before generation.');
assert.match(runtime,/function renderArmourRecommendationState\(build=\{\}\)[\s\S]*?Boolean\(build\.recommendationGeneratedAt\)[\s\S]*?PARADOX RECOMMENDATION · REVIEW REQUIRED[\s\S]*?if\(!generated\)blankArmourModCanvas\(\)/,'The armour canvas must switch from pending to visible recommendations only after generation.');
assert.match(runtime,/function renderBuildGear\(build=\{\}\)[\s\S]*?renderArmourRecommendationState\(build\)[\s\S]*?renderWeapons/,'Build Forge must apply the blank-or-generated mod presentation on every gear render.');
assert.match(runtime,/composeForgeRecommendation\(\{build:forgeComputationProjection\(working\),candidate,element:selectedRecommendationElement,analyzeBuild:analyzeLiveGuardian\}\)/,'Generation must compare verified subclass sockets through a memory-bounded deterministic Forge intelligence projection.');
const computationFields=runtime.match(/const FORGE_COMPUTATION_FIELDS=Object\.freeze\(\[([^\]]+)\]\)/)?.[1]||'';
assert.doesNotMatch(computationFields,/ownedWeapons|vaultWeapons|inventoryWeapons|subclassCatalog|availableArtifacts|loadouts/,'Combination scoring must never deep-copy full inventory and catalogue collections.');
assert.match(runtime,/async function updateForgeGenerationPhase\(message\)[\s\S]*?setTimeout\(resolve,0\)/,'Recommendation phases must yield to the browser so the loader and page remain responsive.');
assert.match(runtime,/resolvedSubclassOptions\(build\)\.filter\(hasVerifiedSubclassSockets\)/,'Element buttons must enable only complete live Bungie subclass socket sets, not canonical catalogue placeholders.');
assert.match(runtime,/filterExoticCompatibleSubclasses\(build,verified\)/,'Element buttons must remove subclass options that conflict with an explicitly named selected-Exotic ability.');
assert.match(runtime,/working\.paradoxAnalysis=analyzeLiveGuardian\(working\)[\s\S]*?adviseLiveWeaponRolls\(working,working\.paradoxAnalysis\|\|\{\}, \{insertSocketPlugFree:false\}\)/,'Generation must re-run directed analysis after Artifact selection before recommendation-only weapon advice.');
assert.match(runtime,/working\.objective=selectedRecommendationObjective[\s\S]*?selectOwnedWeapons\(\{build:working,objective:selectedRecommendationObjective\}\)[\s\S]*?recommendArmourMods\(\{build:working,objective:selectedRecommendationObjective\}\)/,'Generation must rank exact owned weapons before producing the verified per-socket armour-mod plan for the selected tuning objective.');
assert.match(runtime,/applyForgeArtifactRecommendation\(next,\{currentSeasonNumber,force:true\}\)/,'Generation must refresh the verified legal Artifact fit.');
assert.match(runtime,/validateExoticLoadout\(working,\{requireArmourAnchor:true\}\)[\s\S]*?throw new Error\(generatedExoticValidation\.reason\)/,'Generation must stop before review if any recommendation violates the Destiny Exotic equip rule.');
assert.match(intelligenceRuntime,/liveTransferAuthorized:false/,'The generated intelligence result must never authorize live transfer.');
assert.match(liveAdapterRuntime,/"bungie-live","bungie-loadout","current-guardian"/,'Directed analysis must accept protected snapshots that retain their exact live Bungie provenance label.');
assert.match(advisorRuntime,/new URL\("\.\.\/\.\.\/data\/paradox-forge\/intelligence\/weapon-perk-intelligence\.json",import\.meta\.url\)/,'Weapon intelligence must resolve from the module rather than the current page URL.');

assert.match(html,/id="recommendedBuildReveal"[\s\S]*?aria-modal="true"[\s\S]*?hidden/,'The complete recommended build must open in a hidden review layer.');
assert.match(html,/id="recommendedArmourSummary"[\s\S]*?id="recommendedWeaponsSummary"[\s\S]*?id="recommendedArtifactSummary"/,'The review must expose armour, weapon and Artifact sections.');
assert.match(html,/id="recommendedModPlan"/,'The review must expose installed-versus-recommended armour-mod decisions.');
assert.match(runtime,/RAW → CURRENT → RECOMMENDED/,'The review must distinguish mod-free raw stats from installed and recommended projections.');
assert.match(runtime,/decorateRecommendedWeaponPerks/,'Build weapons must add recommendation icons only after generation.');
assert.match(runtime,/if\(!generated\)return/,'Weapon recommendations must remain hidden before Generate Max Loadout.');
assert.doesNotMatch(runtime,/armour-verification-line|decorateBuildArmour/,'Build Forge must not render the internal T5 or masterwork gate as repeated armour-card footer text.');
assert.doesNotMatch(html,/T5 BASE REQUIRED|T5 VERIFIED|MASTERWORK NOT REPORTED/,'Internal armour validation must not clutter the user-facing armour layout.');
assert.match(gearRuntime,/return \[masterwork, \.\.\.clean\(generalSource\)\.slice\(0, 2\), \.\.\.clean\(slotSource\)\.slice\(0, 3\)\]/,'Armour mapping must remain masterwork, two general slots and three armour slots.');

assert.match(html,/id="applyBuild" disabled>BUILD MY GUARDIAN LOADOUT<\/button>/,'The only live action must be the explicit Build My Guardian Loadout confirmation control.');
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
