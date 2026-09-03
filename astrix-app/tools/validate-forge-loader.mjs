import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {armourTargetMaximums,matchArmourBuilds} from '../pages/vault/vault-armour-matcher.mjs';
import {ownedExoticGroups,setBonusOptions,setSelectionFeasible,toggleSetSelection} from '../pages/forge-loader/forge-loader-model.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>readFileSync(new URL(path,`file://${root}/`),'utf8');
const set=(hash,name)=>({hash,unresolved:false,identity:{name,description:`${name} description`,icon:''},twoPiece:{requiredSetCount:2,name:`${name} two`,description:'Two-piece effect'},fourPiece:{requiredSetCount:4,name:`${name} four`,description:'Four-piece effect'}});
const stats=value=>[{name:'Health',value},{name:'Weapon',value:Math.max(1,12-value)}];
const item=(slot,itemHash,instance,value,{exotic=false,setHash=null,name=`Item ${instance}`}={})=>({slotIndex:slot,slotKey:['helmet','gauntlets','chest','legs','class-item'][slot],slotLabel:['Helmet','Gauntlets','Chest','Legs','Class Item'][slot],itemHash,itemInstanceId:instance,name,icon:'/item.png',characterClass:'hunter',isExotic:exotic,totalStats:value+Math.max(1,12-value),stats:stats(value),setBonus:setHash?set(setHash,setHash===7001?'Seraph Protocol':setHash===7002?'Deep Protocol':'Duplicate Protocol'):null});

const items=[
  item(0,9001,'exotic-low',3,{exotic:true,name:'Verified Exotic'}),
  item(0,9001,'exotic-high',9,{exotic:true,name:'Verified Exotic'}),
  item(1,1101,'a-1',8,{setHash:7001}),item(2,1102,'a-2',7,{setHash:7001}),item(3,1103,'a-3',6,{setHash:7001}),item(4,1104,'a-4',5,{setHash:7001}),
  item(1,1201,'b-1',4,{setHash:7002}),item(2,1202,'b-2',4,{setHash:7002}),
  item(1,1301,'c-1a',10,{setHash:7003}),item(1,1301,'c-1b',9,{setHash:7003}),
  item(2,1402,'filler-2',2),item(3,1403,'filler-3',2),item(4,1404,'filler-4',2)
];

const exotics=ownedExoticGroups(items,'hunter');
assert.equal(exotics.length,1,'Forge Loader must show one tile per owned Exotic definition.');
assert.equal(exotics[0].instances.length,2,'Duplicate Exotic instances must remain available to the solver.');
assert.equal(exotics[0].representative.itemInstanceId,'exotic-high','The strongest exact copy must lead the Exotic tile.');
assert.equal(ownedExoticGroups(items,'titan').length,0,'The Exotic selector must isolate the selected Guardian class.');

const exotic=exotics[0];
assert.equal(setSelectionFeasible(items,exotic,[{setHash:7001,count:4}]),true,'A legal four-slot set must enable its four-piece bonus.');
assert.equal(setSelectionFeasible(items,exotic,[{setHash:7003,count:2}]),false,'Duplicate items in one slot must not unlock a two-piece bonus.');
assert.equal(setSelectionFeasible(items,exotic,[{setHash:7001,count:2},{setHash:7002,count:2}]),true,'Two compatible two-piece bonuses must be selectable together.');

let options=setBonusOptions(items,exotic,[]);
assert.equal(options.find(row=>row.hash===7001)?.four.disabled,false,'Four compatible pieces must enable the four-piece checkbox.');
assert.equal(options.find(row=>row.hash===7002)?.four.disabled,true,'Two compatible pieces must not enable a four-piece checkbox.');
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

const constrained={fixedExoticHash:9001,fixedExoticSlot:0,setSelections:[{setHash:7001,count:4}]};
const maximums=armourTargetMaximums(items,constrained);
assert.equal(maximums.health,35,'Stat ceilings must include the best owned Exotic copy and the required four-piece set.');
const matches=matchArmourBuilds(items,{health:35},{...constrained,limit:5});
assert.equal(matches[0].items[0].itemInstanceId,'exotic-high','The solver must evaluate exact duplicate Exotic instances.');
assert.equal(matches[0].items.filter(row=>row.setBonus?.hash===7001).length,4,'Every returned load must honour the selected four-piece protocol.');

const html=read('astrix-app/pages/forge-loader/index.html');
const css=read('astrix-app/pages/forge-loader/forge-loader.css');
const runtime=read('astrix-app/pages/forge-loader/forge-loader.mjs');
const ribbon=read('astrix-app/shared/astrix-destination-ribbon.js');
const access=read('astrix-app/pages/guardian-workspace-v2/guardian-vault-access.mjs');
assert.match(html,/<h1>Forge Loader<\/h1>/);
assert.match(html,/id="forgeHeroCard"/);
assert.match(html,/id="forgeExoticSlots"/);
assert.match(html,/id="forgeSetList"/);
assert.equal((html.match(/data-target-stat=/g)||[]).length,6,'Forge Loader must retain all six Armour 3.0 stat directives.');
assert.match(runtime,/type="checkbox"/,'Set bonuses must use checkboxes, not toggle switches.');
assert.match(runtime,/setBonusOptions\(armourItems\(\),exotic,setSelections\)/);
assert.match(runtime,/fixedExoticHash:exotic\.hash/);
assert.match(runtime,/matchArmourBuilds\(armourItems\(\),targets,\{\.\.\.solverOptions\(\),limit:5/);
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
