import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ARMOUR_STAT_CAP,armourTargetMaximums,matchArmourBuilds,normaliseTargets,scoreArmourStats} from '../pages/vault/vault-armour-matcher.mjs';
import {applyVaultArmourSelection,createVaultArmourSelection,validateVaultArmourSelection} from '../pages/vault/vault-selection-state.mjs';
import {exoticCatalogueGroups,ownedExoticGroups,setBonusOptions,setSelectionFeasible,toggleSetSelection} from '../pages/forge-loader/forge-loader-model.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>readFileSync(new URL(path,`file://${root}/`),'utf8');
const set=(hash,name)=>({hash,unresolved:false,identity:{name,description:`${name} description`,icon:''},twoPiece:{requiredSetCount:2,name:`${name} two`,description:'Two-piece effect',icon:`/set-${hash}-2.png`},fourPiece:{requiredSetCount:4,name:`${name} four`,description:'Four-piece effect',icon:`/set-${hash}-4.png`}});
const stats=value=>[{name:'Health',value},{name:'Weapon',value:Math.max(1,12-value)}];
const item=(slot,itemHash,instance,value,{exotic=false,setHash=null,name=`Item ${instance}`}={})=>({slotIndex:slot,slotKey:['helmet','gauntlets','chest','legs','class-item'][slot],slotLabel:['Helmet','Gauntlets','Chest','Legs','Class Item'][slot],itemHash,itemInstanceId:instance,name,icon:'/item.png',characterClass:'hunter',isExotic:exotic,totalStats:value+Math.max(1,12-value),stats:stats(value),setBonus:setHash?set(setHash,setHash===7001?'Seraph Protocol':setHash===7002?'Deep Protocol':'Duplicate Protocol'):null});

const items=[
  item(0,9001,'exotic-low',3,{exotic:true,name:'Verified Exotic'}),
  item(0,9001,'exotic-high',9,{exotic:true,name:'Verified Exotic'}),
  item(0,9004,'exotic-reissue',15,{exotic:true,name:'Verified Exotic'}),
  item(1,1101,'a-1',8,{setHash:7001}),item(2,1102,'a-2',7,{setHash:7001}),item(3,1103,'a-3',6,{setHash:7001}),item(4,1104,'a-4',5,{setHash:7001}),
  item(1,1201,'b-1',4,{setHash:7002}),item(2,1202,'b-2',4,{setHash:7002}),
  item(1,1301,'c-1a',10,{setHash:7003}),item(1,1301,'c-1b',9,{setHash:7003}),
  item(2,1402,'filler-2',2),item(3,1403,'filler-3',2),item(4,1404,'filler-4',2)
];

const exotics=ownedExoticGroups(items,'hunter');
assert.equal(exotics.length,1,'Forge Loader must show one tile per owned Exotic definition.');
assert.equal(exotics[0].instances.length,3,'Duplicate and reissued Exotic instances must remain available to the solver.');
assert.deepEqual(exotics[0].hashes,[9001,9004],'One Exotic identity must retain every owned Bungie item hash behind its single tile.');
assert.equal(exotics[0].representative.itemInstanceId,'exotic-reissue','The strongest exact copy across every owned hash must lead the Exotic tile.');
assert.equal(ownedExoticGroups(items,'titan').length,0,'The Exotic selector must isolate the selected Guardian class.');
const definitions={
  9001:{hash:9001,itemType:2,classType:1,equippable:true,inventory:{tierType:6,tierTypeName:'Exotic',bucketTypeHash:3448274439},displayProperties:{name:'Verified Exotic',icon:'/item.png'}},
  9002:{hash:9002,itemType:2,classType:1,equippable:true,inventory:{tierType:6,tierTypeName:'Exotic',bucketTypeHash:3551918588},displayProperties:{name:'Unowned Hunter Exotic',description:'Verified collection definition',icon:'/unowned.png'}},
  9003:{hash:9003,itemType:2,classType:0,equippable:true,inventory:{tierType:6,tierTypeName:'Exotic',bucketTypeHash:3551918588},displayProperties:{name:'Titan Exotic',icon:'/titan.png'}},
  9004:{hash:9004,itemType:2,classType:1,equippable:true,inventory:{tierType:6,tierTypeName:'Exotic',bucketTypeHash:3448274439},displayProperties:{name:'Verified Exotic',icon:'/item-reissue.png'}},
  9005:{hash:9005,itemType:2,classType:1,equippable:true,inventory:{tierType:6,tierTypeName:'Exotic',bucketTypeHash:3551918588},displayProperties:{name:'Unowned Hunter Exotic',description:'Reissued collection definition',icon:'/unowned-reissue.png'}}
};
const buckets=[
  {hash:3448274439,key:'helmet',label:'Helmet'},
  {hash:3551918588,key:'gauntlets',label:'Gauntlets'},
  {hash:14239492,key:'chest',label:'Chest'},
  {hash:20886954,key:'legs',label:'Legs'},
  {hash:1585787867,key:'class-item',label:'Class Item'}
];
const catalogueExotics=exoticCatalogueGroups(items,definitions,'hunter',buckets);
assert.equal(catalogueExotics.length,2,'Forge Loader must combine owned instances with verified unowned collection definitions for the selected class.');
assert.equal(catalogueExotics.find(row=>row.name==='Verified Exotic')?.owned,true,'Owned Exotic identities must remain selectable instance groups.');
assert.deepEqual(catalogueExotics.find(row=>row.name==='Unowned Hunter Exotic')?.hashes,[9002,9005],'Reissued unowned definitions must collapse into one visibly distinct collection tile.');
assert.equal(catalogueExotics.some(row=>row.hash===9003),false,'Exotic collection entries must remain isolated to the selected Guardian class.');

const exotic=exotics[0];
assert.equal(setSelectionFeasible(items,exotic,[{setHash:7001,count:4}]),true,'A legal four-slot set must enable its four-piece bonus.');
assert.equal(setSelectionFeasible(items,exotic,[{setHash:7003,count:2}]),false,'Duplicate items in one slot must not unlock a two-piece bonus.');
assert.equal(setSelectionFeasible(items,exotic,[{setHash:7001,count:2},{setHash:7002,count:2}]),true,'Two compatible two-piece bonuses must be selectable together.');

let options=setBonusOptions(items,exotic,[]);
assert.equal(options.find(row=>row.hash===7001)?.four.disabled,false,'Four compatible pieces must enable the four-piece checkbox.');
assert.equal(options.find(row=>row.hash===7001)?.four.owned,true,'An owned four-piece trait must receive the available visual state.');
assert.equal(options.find(row=>row.hash===7002)?.four.disabled,true,'Two compatible pieces must not enable a four-piece checkbox.');
assert.equal(options.find(row=>row.hash===7002)?.four.owned,false,'A four-piece trait without four compatible owned slots must retain the unavailable visual state.');
assert.equal(options.find(row=>row.hash===7003)?.two.disabled,true,'Two copies in the same slot must keep the two-piece checkbox disabled.');

let selected=toggleSetSelection(items,exotic,[],{setHash:7001,count:4},true);
options=setBonusOptions(items,exotic,selected);
assert.equal(selected.length,1);assert.equal(selected[0].count,4);
assert.equal(options.find(row=>row.hash===7001)?.two.disabled,true,'Selecting four-piece must disable its two-piece checkbox.');
assert.equal(options.find(row=>row.hash===7002)?.two.disabled,true,'Selecting four-piece must disable other set bonuses.');

selected=toggleSetSelection(items,exotic,[],{setHash:7001,count:2},true);
selected=toggleSetSelection(items,exotic,selected,{setHash:7002,count:2},true);
options=setBonusOptions(items,exotic,selected);
assert.equal(selected.length,2,'A second compatible two-piece bonus must remain selectable.');
assert.ok(options.every(row=>row.four.disabled),'Any two-piece selection must disable every four-piece checkbox.');
assert.equal(options.find(row=>row.hash===7003)?.two.disabled,true,'After two two-piece choices, all remaining two-piece choices must be disabled.');

const constrained={fixedExoticHashes:exotic.hashes,fixedExoticSlot:0,setSelections:[{setHash:7001,count:4}]};
const maximums=armourTargetMaximums(items,constrained);
assert.equal(maximums.health,41,'Stat ceilings must include the best owned Exotic copy across every hash and the required four-piece set.');
assert.equal(ARMOUR_STAT_CAP,200,'Every Armour 3.0 stat must use the absolute 200-point ceiling.');
assert.equal(normaliseTargets({health:210}).health,200,'A requested stat target must never exceed 200.');
assert.equal(scoreArmourStats({health:210},{health:200}).effectiveStats.health,200,'Ranking must treat any raw per-stat overflow as 200 effective points.');
const matches=matchArmourBuilds(items,{health:35},{...constrained,all:true});
assert.equal(matches.length,3,'The Forge Loader must return every legal exact-instance combination rather than an arbitrary top-five subset.');
assert.equal(matches[0].items[0].itemInstanceId,'exotic-reissue','The solver must rank the strongest exact duplicate or reissued Exotic instance first.');
assert.equal(matches[0].items.filter(row=>row.setBonus?.hash===7001).length,4,'Every returned load must honour the selected four-piece protocol.');
const binding={characterId:'hunter-1',membershipId:'membership-1',membershipType:'3'};
const forgeLoaderDecision={schemaVersion:1,buildAnchor:{identityKey:exotic.key,name:exotic.name,itemHashes:exotic.hashes,selectedItemHash:9004,selectedItemInstanceId:'exotic-reissue',perk:{hash:88001,name:'Verified Exotic perk',description:'Verified perk description',icon:'/perk.png'}},statDirective:{targets:{health:35,melee:0,grenade:0,super:0,class:0,weapon:0},achieved:matches[0].stats,allTargetsMet:matches[0].score.met,shortfall:matches[0].score.shortfall,rawTotal:matches[0].score.total,modsApplied:false},setProtocol:[{setHash:7001,count:4,setName:'Seraph Protocol',trait:{hash:77001,name:'Seraph four',description:'Four-piece effect',icon:'/set-7001-4.png'}}],ranking:{position:1,totalCombinations:matches.length,maximized:true}};
const selection=createVaultArmourSelection({binding,slots:matches[0].items.map(item=>({slot:item.slotIndex,item})),sourcePage:'forge-loader',forgeLoaderDecision});
const verifiedSelection=validateVaultArmourSelection(selection,{expectedBinding:binding});
assert.equal(verifiedSelection?.forgeLoaderDecision?.buildAnchor?.selectedItemInstanceId,'exotic-reissue','The exact solver-selected Exotic instance must survive the protected handoff.');
assert.deepEqual(verifiedSelection?.forgeLoaderDecision?.statDirective?.targets,forgeLoaderDecision.statDirective.targets,'All six user stat directives must survive the protected handoff.');
assert.equal(verifiedSelection?.forgeLoaderDecision?.setProtocol?.[0]?.count,4,'The selected armour set protocol must survive the protected handoff.');
assert.equal(verifiedSelection?.forgeLoaderDecision?.ranking?.maximized,true,'The top-ranked load must retain its maximized evidence.');
assert.equal(validateVaultArmourSelection({...selection,forgeLoaderDecision:{...selection.forgeLoaderDecision,buildAnchor:{...selection.forgeLoaderDecision.buildAnchor,selectedItemInstanceId:'wrong-instance'}}},{expectedBinding:binding}),null,'The handoff must reject decision evidence that does not match the staged exact Exotic instance.');
const sourceState={originalBuild:{...binding,armour:Array(5).fill(null)},workingBuild:{...binding,armour:Array(5).fill(null)},recommendation:{stale:true},validationRecords:[{stale:true}]};
const appliedSelection=applyVaultArmourSelection(sourceState,verifiedSelection);
assert.equal(appliedSelection.applied,true,'Build Forge must accept the character-bound Forge Loader handoff.');
assert.deepEqual(appliedSelection.state.workingBuild.forgeLoaderDecision,verifiedSelection.forgeLoaderDecision,'Build Forge Working Build must retain the complete Forge Loader decision chain in the background.');
assert.equal(sourceState.originalBuild.armour.every(item=>item===null),true,'The Forge Loader decision must never mutate the protected Original Build.');

const html=read('astrix-app/pages/forge-loader/index.html');
const css=read('astrix-app/pages/forge-loader/forge-loader.css');
const runtime=read('astrix-app/pages/forge-loader/forge-loader.mjs');
const selectionState=read('astrix-app/pages/vault/vault-selection-state.mjs');
const ribbon=read('astrix-app/shared/astrix-destination-ribbon.js');
const access=read('astrix-app/pages/guardian-workspace-v2/guardian-vault-access.mjs');
assert.match(html,/<h1>Forge Loader<\/h1>/);
assert.match(html,/id="forgeHeroCard"/);
assert.match(html,/id="forgeExoticSlots"/);
assert.match(html,/id="forgeSetList"/);
const selectorIndex=html.indexOf('class="forge-loader-selector"');
const directivesIndex=html.indexOf('class="forge-loader-directives"');
const outputIndex=html.indexOf('class="forge-loader-output"');
assert.ok(selectorIndex>=0&&selectorIndex<directivesIndex&&directivesIndex<outputIndex,'Forge Loader desktop DOM must order selection, directives and Working Load as three columns.');
assert.ok(html.indexOf('forge-stat-selector')<html.indexOf('forge-set-selector'),'Set Protocol must sit underneath Stat Directive in the middle column.');
assert.equal((html.match(/data-target-stat=/g)||[]).length,6,'Forge Loader must retain all six Armour 3.0 stat directives.');
assert.equal((html.match(/max="200" value="0" step="1" disabled><output>0 \/ 200<\/output>/g)||[]).length,6,'All six Stat Directives must present the 200-point cap before live inventory finishes loading.');
assert.match(runtime,/output\.textContent=`\$\{value\} \/ \$\{ARMOUR_STAT_CAP\}`/,'Every Stat Directive output must use the fixed current-target / 200 presentation.');
assert.match(runtime,/input\.max=String\(ARMOUR_STAT_CAP\)/,'Every Stat Directive slider and MAX action must target the absolute 200-point cap.');
assert.match(runtime,/--forge-slider-fill[\s\S]*?value\/ARMOUR_STAT_CAP\*100/,'Each slider must fill proportionally to its selected value on the 200-point scale.');
assert.match(css,/linear-gradient\(90deg,#d9b340 0 var\(--forge-slider-fill,0%\),rgba\(41,199,143,\.5\) var\(--forge-slider-fill,0%\) 100%\)/,'The slider track must show gold through the selected point and Forge green through the unselected range.');
assert.match(runtime,/type="checkbox"/,'Set bonuses must use checkboxes, not toggle switches.');
assert.match(runtime,/setBonusOptions\(armourItems\(\),exotic,setSelections\)/);
assert.match(runtime,/class="forge-set-trait-icon"[\s\S]*?effect\.icon/,'Each 2-piece and 4-piece block must render its verified Bungie trait icon.');
assert.match(runtime,/forge-set-trait-copy[\s\S]*?effect\?\.description/,'Each set block must expose the verified trait name and description.');
assert.match(css,/\.forge-set-choice\.is-owned \.forge-set-trait-icon\{[^}]*background:rgba\(77,177,255,\.34\)/,'Owned feasible set traits must use the blue Bungie-style icon background.');
assert.match(css,/\.forge-set-trait-icon img\{[^}]*filter:grayscale\(1\) brightness\(2\)/,'Unavailable set traits must retain a white trait icon on the dark block.');
assert.match(runtime,/fixedExoticHashes:exotic\.hashes/,'The selected Exotic identity must pass every owned item hash to the solver.');
assert.match(runtime,/matchArmourBuilds\(armourItems\(\),targets,\{\.\.\.solverOptions\(\),all:true/,'Forge Loader must calculate every legal combination.');
assert.match(runtime,/exoticCatalogueGroups\(catalogue\.armour,inventoryDefinitions\(\),activeCharacterClass,ARMOUR_BUCKETS\)/,'Forge Loader must add verified class collection definitions without fabricating inventory instances.');
assert.match(runtime,/aria-disabled="\$\{group\.owned\?'false':'true'\}"/,'Unowned Exotic identities must remain inspectable but visibly unavailable.');
assert.match(runtime,/group\.owned&&group\.key===String\(key\|\|''\)/,'The runtime must reject any unowned Exotic selection attempt.');
assert.match(runtime,/data-exotic-key="\$\{esc\(group\.key\)\}"/,'Only one identity key may activate every owned copy behind an Exotic tile.');
assert.match(html,/id="forgeExoticStatus" hidden/,'The Exotic definition count must remain available without cluttering the visible selector.');
assert.doesNotMatch(html,/Every verified Exotic for the selected class/,'The Exotic selector must present the icon list without an explanatory block.');
assert.doesNotMatch(runtime,/<span>\$\{group\.owned\?`×\$\{group\.instances\.length\}`:'LOCKED'<\/span>/,'Duplicate and ownership labels must not cover the Exotic artwork.');
assert.doesNotMatch(css,/\.forge-exotic>span|content:"ANCHOR"/,'Exotic ownership and selection must use artwork state and the PARADOX border rather than text overlays.');
assert.match(html,/CALCULATE ALL COMBINATIONS/,'The Stat Directive must request the complete legal combination set.');
assert.match(runtime,/CANDIDATE_BATCH_SIZE=50[\s\S]*?matchedBuilds\.slice\(0,shown\)/,'The complete result set must render in responsive batches without truncating calculation.');
assert.doesNotMatch(runtime,/CALCULATE 5 COMBINATIONS|refresh the five legal combinations/,'Forge Loader must not retain a five-result limitation.');
assert.match(runtime,/Five exact Bungie armour instances · no mods[\s\S]*?UNMODDED ARMOUR TOTAL/,'Forge Matrix must identify that its ranking excludes mods.');
assert.doesNotMatch(runtime,/ARMOUR_STAT_LABELS\[key\]\.slice/,'Calculated loads must show full stat names rather than unreadable abbreviations.');
assert.match(html,/<h2 id="forgeResultsTitle">Forge Matrix<\/h2>/,'Calculated combinations must use the independent PARADOX Forge Matrix identity.');
assert.match(runtime,/class="forge-matrix-row"[\s\S]*?class="forge-matrix-stats"[\s\S]*?class="forge-matrix-total"[\s\S]*?class="forge-matrix-protocol"/,'Each compact load must expose six calculated stats, total and set protocol in one comparison row.');
assert.match(runtime,/maximized=index===0[\s\S]*?is-maximized[\s\S]*?MAXIMIZED/,'The highest-ranked complete owned load must receive the unique PARADOX Maximized state.');
assert.match(css,/\.forge-candidate\.is-maximized\{[^}]*border:2px solid #e4bd49/,'The Maximized load must use a deliberate gold perimeter rather than a generic selected state.');
assert.match(runtime,/data-candidate-expand="\$\{index\}"[\s\S]*?aria-controls="forgeLoadBreakdown\$\{index\}"/,'Every Forge Matrix row must provide an accessible expandable breakdown control.');
assert.match(runtime,/Five exact Bungie armour instances[\s\S]*?candidate\.items\.map\(candidateItemMarkup\)/,'Expanded loads must enumerate all five exact owned armour instances.');
assert.match(runtime,/item\.source\?\.label[\s\S]*?item\.power[\s\S]*?item\.energy\?\.capacity[\s\S]*?Number\(item\.state\|\|0\)&4/,'The breakdown may show only verified source, Power, energy and masterwork instance data.');
assert.match(runtime,/data-candidate-evaluate="\$\{index\}"/,'An expanded verified load must retain its protected Build Forge evaluation action.');
assert.match(runtime,/forgeLoaderDecision:forgeLoaderDecision\(candidate,selectedCandidateIndex\)/,'The staged load must send the user\'s complete three-stage decision to Build Forge.');
assert.match(selectionState,/next\.workingBuild\.forgeLoaderDecision=clone\(verified\.forgeLoaderDecision\)/,'Build Forge application must retain the verified Forge Loader decision on Working Build only.');
assert.doesNotMatch(runtime,/\bDIM\b|d2armou?rpicker/i,'Forge Loader must not copy external picker branding or actions.');
assert.match(css,/\.forge-loader-workspace\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,'Wide Forge Loader must use three equal columns.');
assert.doesNotMatch(css,/@media\(max-width:1700px\)[\s\S]*?\.forge-loader-output\{grid-column:1\/-1\}/,'Forge Loader must retain three equal desktop columns until the tablet breakpoint.');
assert.match(css,/\.forge-hero-card\{[^}]*aspect-ratio:474\/96[^}]*overflow:hidden/,'The selected Guardian emblem must fit inside its card boundary.');
assert.match(css,/\.forge-stat-targets label>span\{[^}]*\.9rem/,'Eligible stat labels must retain the enlarged readable type scale.');
assert.match(css,/\.forge-matrix-stat small\{font-size:\.92rem\}[\s\S]*?\.forge-matrix-stat b\{font-size:1\.25rem\}/,'Forge Matrix stat labels and values must remain readable at the approved desktop density.');
assert.match(css,/@container\(max-width:60rem\)[\s\S]*?\.forge-matrix-stats\{grid-column:1\/-1;grid-row:2\}/,'Forge Matrix rows must reflow calculated stats without clipping in a narrow output column.');
assert.match(runtime,/document\.documentElement\.append\(panel\)/,'The inspection card must escape the density-scaled body before viewport positioning.');
assert.match(runtime,/getBoundingClientRect\(\)/,'The inspection card must anchor to the selected item.');
assert.doesNotMatch(css,/\.forge-item-inspect\{[^}]*right:/,'The inspection card must not be fixed to the top-right dashboard corner.');
const loaderIndex=ribbon.indexOf("key:'forge-loader'");
const buildIndex=ribbon.indexOf("key:'build-forge'");
assert.ok(loaderIndex>=0&&loaderIndex<buildIndex,'Forge Loader must appear immediately before Build Forge.');
assert.match(access,/new URL\('\/astrix-app\/pages\/forge-loader\/'/,'Character and Build armour selection must open Forge Loader.');
assert.match(access,/OPEN FORGE LOADER/);

console.log('FORGE_LOADER_EXOTIC_SELECTOR=PASS');
console.log('FORGE_LOADER_SET_PROTOCOL=PASS');
console.log('FORGE_LOADER_CONSTRAINED_MATCHER=PASS');
console.log('FORGE_LOADER_NAVIGATION=PASS');
