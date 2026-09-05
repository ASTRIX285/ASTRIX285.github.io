#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createLiveTransferPlan} from '../pages/guardian-workspace-v2/guardian-perk-change-plan.mjs';
import {createLiveTransferPreflight} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-loadout-intelligence.mjs';
import {eligibleEquipment,stageEquipmentChoice,stageSocketChoice,stageSubclassSocketChoice} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-manual-editor.mjs';
import {compactBuild,createParadoxLoadoutRecord,validateParadoxLoadoutRecord} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-saved-loadouts.mjs';
import {confirmBungieLoadoutAction,confirmLiveTransferPlan,executeBungieLoadoutAction,executeLiveTransferPlan,stageBungieLoadoutAction} from '../pages/guardian-workspace-v2/guardian-live-actions.mjs';

const CHARACTER_ID='9100001';
const MEMBERSHIP_ID='9200001';
const MEMBERSHIP_TYPE='3';
const WEAPON_BUCKETS=[1498876634,2465295065,953998645];
const ARMOUR_BUCKETS=[3448274439,3551918588,14239492,20886954,1585787867];
const VAULT_BUCKET=138197802;
const clone=value=>structuredClone(value);
const response=payload=>({ok:true,status:200,json:async()=>payload});
const perk=(hash,name,{source='bungie-item-reusable-plugs',evidence='exact-item-reusable-plug'}={})=>({
  hash,itemHash:hash,bungieHash:hash,name,socketIndex:3,canInsert:true,enabled:true,source,remoteInsertEvidence:evidence,
  definition:{displayProperties:{name},plug:{plugCategoryIdentifier:'weapon.perks.traits'}}
});
const currentPerk=perk(8100,'Current Trait');
const exactPerk=perk(8101,'Exact Reusable Trait');
const compatibleOnlyPerk=perk(8102,'Compatible In-Game Trait',{source:'bungie-profile-plug-set',evidence:'compatible-plug-set'});
const ownedSource={kind:'equipped',characterId:CHARACTER_ID};

const weapons=WEAPON_BUCKETS.map((bucketHash,index)=>({
  itemHash:11000+index,hash:11000+index,itemInstanceId:String(11100+index),name:`Weapon ${index+1}`,bucketHash,source:ownedSource,
  ...(index===0?{socketCoverage:{complete:true,plugs:[currentPerk]},socketOptions:{3:[currentPerk,exactPerk,compatibleOnlyPerk]},selectedPerks:[currentPerk],weaponSemantics:{gearTier:3,selectedPerks:[currentPerk],alternativePerkColumns:[{socketIndex:3,options:[currentPerk,exactPerk,compatibleOnlyPerk]}]}}:{})
}));
const armour=ARMOUR_BUCKETS.map((bucketHash,index)=>({itemHash:12000+index,hash:12000+index,itemInstanceId:String(12100+index),name:`Armour ${index+1}`,bucketHash,classType:1,source:ownedSource}));
const baseBuild={
  source:'bungie-live',characterId:CHARACTER_ID,membershipId:MEMBERSHIP_ID,membershipType:MEMBERSHIP_TYPE,characterClass:'hunter',
  weapons,armour,artifact:{name:'Seasonal Artifact',activePerks:[{hash:9001,isActive:true}]},artifactConfiguration:{artifactHash:9000,selectedPerkHashes:[9002]}
};

const sameItemBuild=clone(baseBuild);
stageEquipmentChoice(sameItemBuild,'weapon',0,sameItemBuild.weapons[0]);
assert.equal(sameItemBuild.manualEdits,undefined,'Selecting the already staged exact item must be a no-op.');

const replacement={itemHash:13001,hash:13001,itemInstanceId:'13101',name:'Vault Energy Weapon',bucketHash:WEAPON_BUCKETS[1],source:{kind:'vault',characterId:null}};
const equipmentBuild=clone(baseBuild);
stageEquipmentChoice(equipmentBuild,'weapon',1,replacement);
assert.equal(equipmentBuild.weapons[1].itemInstanceId,replacement.itemInstanceId,'A verified exact owned item must stage without Generate.');
assert.equal(equipmentBuild.editMode,'manual');
assert.equal(equipmentBuild.manualEdits.at(-1).component,'weapon');
assert.throws(()=>stageEquipmentChoice(clone(baseBuild),'weapon',1,{...replacement,bucketHash:WEAPON_BUCKETS[2]}),/does not belong/,'A mismatched equipment bucket must be rejected.');
assert.throws(()=>stageEquipmentChoice({...clone(baseBuild),weapons:[{...weapons[0],isExotic:true},...clone(weapons.slice(1))]},'weapon',1,{...replacement,isExotic:true}),/only one Exotic weapon/,'A second Exotic weapon must be rejected.');
assert.deepEqual(eligibleEquipment([replacement,{...armour[0],itemInstanceId:'13102',bucketHash:WEAPON_BUCKETS[0]}],baseBuild,'weapon',1).map(row=>row.itemInstanceId),['13101'],'Manual choices must stay inside the requested equipment bucket.');

const exactSocketBuild=clone(equipmentBuild);
stageSocketChoice(exactSocketBuild,'weapon',0,3,exactPerk);
assert.equal(exactSocketBuild.weapons[0].socketCoverage.plugs.find(row=>row.socketIndex===3).hash,exactPerk.hash);
assert.equal(exactSocketBuild.manualSocketChanges[0].remoteSupported,true,'Only exact-item reusable-plug evidence may stage a remote socket action.');
assert.equal(exactSocketBuild.manualEdits.at(-1).component,'weapon-socket');

const inGameSocketBuild=clone(equipmentBuild);
stageSocketChoice(inGameSocketBuild,'weapon',0,3,compatibleOnlyPerk);
assert.equal(inGameSocketBuild.manualSocketChanges[0].remoteSupported,false,'A compatible plug-set choice must remain an explicit in-game step.');

const originalAbility={...perk(8110,'Original Grenade'),socketIndex:7,componentType:'grenade'};
const switchedAbility={...perk(8111,'New Subclass Grenade'),socketIndex:7,componentType:'grenade'};
const switchedSubclassBuild={...clone(equipmentBuild),subclass:'void',subclassName:'Void Hunter',subclassItemInstanceId:'14101',subclassItem:{itemHash:14001,hash:14001,itemInstanceId:'14101',name:'Void Hunter',bucketHash:3284755031,classType:1,source:{kind:'carried',characterId:CHARACTER_ID}},subclassBuild:{abilities:[originalAbility],aspects:[],fragments:[]}};
switchedSubclassBuild.subclassBuild.abilities=[switchedAbility];stageSubclassSocketChoice(switchedSubclassBuild,originalAbility,switchedAbility,'ability');
const switchedPlan=createLiveTransferPlan({build:switchedSubclassBuild,originalBuild:baseBuild,capabilities:{captureSnapshot:true,transferItems:true,equipItems:true,verifyEquipment:true,insertSocketPlugFree:true,verifyFinalState:true}});
assert.ok(switchedPlan.equipment.targets.some(row=>row.kind==='subclass'&&row.itemInstanceId==='14101'),'A switched exact subclass instance must enter the equipment target set.');
assert.ok(switchedPlan.socketChanges.some(row=>row.itemInstanceId==='14101'&&row.plugHash===switchedAbility.hash),'Manual sockets edited after a subclass switch must enter the exact Apply ledger.');

const preflight=createLiveTransferPreflight(exactSocketBuild);
assert.equal(preflight.ready,true,preflight.violations.join(' | '));
assert.equal(preflight.mode,'manual-working-build','Manual Apply must not require a generated recommendation.');
const overCapacityBuild=clone(exactSocketBuild);overCapacityBuild.armour[0].energy={capacity:5};overCapacityBuild.armour[0].generalMods=[{name:'Four Energy',energyCost:4}];overCapacityBuild.armour[0].slotMods=[{name:'Three Energy',energyCost:3}];
const overCapacityPreflight=createLiveTransferPreflight(overCapacityBuild);
assert.equal(overCapacityPreflight.ready,false,'A manual armour-mod selection above the item energy capacity must block Apply.');
assert.match(overCapacityPreflight.violations.join(' | '),/uses 7\/5 armour energy/);
const capabilities={captureSnapshot:true,transferItems:true,equipItems:true,verifyEquipment:true,insertSocketPlugFree:true,verifyFinalState:true};
const plan=createLiveTransferPlan({build:exactSocketBuild,originalBuild:baseBuild,capabilities});
assert.equal(plan.ready,true,plan.blockers.join(' | '));
assert.equal(plan.status,'staged');
assert.equal(plan.transfers.length,1,'The plan must transfer the selected Vault item before equipping.');
assert.equal(plan.socketChanges.length,1,'The exact reusable socket choice must remain remotely actionable.');
assert.ok(plan.inGameSteps.some(step=>step.includes('Seasonal Artifact')),'Unsupported Artifact configuration must be retained as an explicit in-game step.');

const saved=createParadoxLoadoutRecord({name:'Manual Hunter Test',description:'Independent browser-only copy',build:{...exactSocketBuild,loadoutActionIntent:'save-paradox-copy',ownedWeapons:Array.from({length:100},()=>replacement)}});
assert.equal(saved.binding.characterId,CHARACTER_ID);
assert.equal(saved.summary.manualEditCount,2);
assert.equal(saved.build.ownedWeapons,undefined,'Broad account catalogues must not be duplicated inside named PARADOX records.');
assert.equal(saved.build.loadoutActionIntent,undefined,'One-time Bungie menu intents must not reopen inside a durable PARADOX record.');
assert.equal(saved.build.manualSocketChanges[0].plugHash,exactPerk.hash,'Manual socket provenance must survive a PARADOX save.');
assert.equal(validateParadoxLoadoutRecord(saved)?.id,saved.id);
assert.equal(compactBuild(exactSocketBuild).source,'paradox-saved-loadout');

const session={
  authenticated:true,csrfToken:'csrf-test',activeDestinyMembership:{membershipId:MEMBERSHIP_ID,membershipType:Number(MEMBERSHIP_TYPE)},
  capabilities:{destinyActions:{...capabilities,equipLoadout:true,snapshotLoadout:true,updateLoadoutIdentifiers:true,clearLoadout:true}}
};
let prematureCalls=0;
await assert.rejects(()=>executeLiveTransferPlan(plan,{session,fetchImpl:async()=>{prematureCalls+=1;return response({ErrorCode:1});},authOrigin:'https://auth.test'}),/Final user confirmation/);
assert.equal(prematureCalls,0,'An unconfirmed Apply plan must make zero requests.');

const targetItems=plan.equipment.targets.map(target=>({itemInstanceId:target.itemInstanceId,itemHash:target.itemHash}));
const initialEquipment=targetItems.filter(item=>item.itemInstanceId!==replacement.itemInstanceId);
const socketsFor=plugHash=>({[weapons[0].itemInstanceId]:{sockets:Array.from({length:4},(_,index)=>index===3?{plugHash}:{})}});
const profilePayload=({final=false,compatible=true}={})=>({ErrorCode:1,profile:{
  profileInventory:{data:{items:final?[]:[{itemInstanceId:replacement.itemInstanceId,itemHash:replacement.itemHash,bucketHash:VAULT_BUCKET}]}},
  characterInventories:{data:{[CHARACTER_ID]:{items:[]}}},
  characterEquipment:{data:{[CHARACTER_ID]:{items:final?targetItems:initialEquipment}}},
  itemComponents:{
    reusablePlugs:{data:{[weapons[0].itemInstanceId]:{plugs:{3:compatible?[{plugItemHash:exactPerk.hash,canInsert:true,enabled:true}]:[]}}}},
    sockets:{data:socketsFor(final?exactPerk.hash:currentPerk.hash)}
  }
}});

let profileReads=0;
const postPaths=[];
const postBodies=[];
let waitCalls=0;
const fetchImpl=async(url,init={})=>{
  const parsed=new URL(String(url));
  if(String(init.method||'GET').toUpperCase()==='POST'){
    postPaths.push(parsed.pathname);postBodies.push(JSON.parse(init.body));return response({ErrorCode:1,Message:'Ok'});
  }
  profileReads+=1;return response(profilePayload({final:profileReads>1}));
};
const applied=await executeLiveTransferPlan(confirmLiveTransferPlan(plan),{session,fetchImpl,authOrigin:'https://auth.test',waitImpl:async()=>{waitCalls+=1;}});
assert.equal(applied.status,'applied');
assert.equal(applied.readback.verified,true);
assert.deepEqual(postPaths,['/bungie/actions/transfer-item','/bungie/actions/equip-items','/bungie/actions/socket-plug-free'],'Apply must transfer, then equip, then insert exact verified sockets.');
assert.equal(postBodies[0].itemId,replacement.itemInstanceId);
assert.deepEqual(postBodies[1].itemIds,plan.equipment.targets.map(row=>row.itemInstanceId));
assert.deepEqual(postBodies[2].plug,{socketIndex:3,socketArrayType:0,plugItemHash:exactPerk.hash});
assert.equal(waitCalls,0,'A one-socket Apply needs no inter-request throttle delay.');

let partialProfileReads=0;
const partialPosts=[];
const partialEquip=await executeLiveTransferPlan(confirmLiveTransferPlan(plan),{
  session,authOrigin:'https://auth.test',waitImpl:async()=>{},
  fetchImpl:async(url,init={})=>{
    const parsed=new URL(String(url));
    if(String(init.method||'GET').toUpperCase()!=='POST'){partialProfileReads+=1;return response(profilePayload({final:false}));}
    partialPosts.push(parsed.pathname);
    if(parsed.pathname.endsWith('/equip-items'))return response({ErrorCode:1,Response:{equipResults:plan.equipment.targets.map((row,index)=>({itemInstanceId:row.itemInstanceId,equipStatus:index===0?99:1}))}});
    return response({ErrorCode:1,Message:'Ok'});
  }
});
assert.equal(partialEquip.status,'partial');
assert.deepEqual(partialPosts,['/bungie/actions/transfer-item','/bungie/actions/equip-items'],'A per-item equip failure must skip every later socket mutation.');
assert.equal(partialProfileReads,2,'A partial equip must still finish with a Bungie readback.');

let unsupportedCalls=0;
await assert.rejects(()=>executeLiveTransferPlan(confirmLiveTransferPlan(plan),{session:{...session,capabilities:{destinyActions:{...session.capabilities.destinyActions,equipItems:false}}},fetchImpl:async()=>{unsupportedCalls+=1;return response({ErrorCode:1});},authOrigin:'https://auth.test'}),/no longer supports/);
assert.equal(unsupportedCalls,0,'A changed capability contract must block before fresh reads or mutations.');

let incompatibleProfileReads=0;
let incompatiblePosts=0;
const incompatible=await executeLiveTransferPlan(confirmLiveTransferPlan(plan),{
  session,authOrigin:'https://auth.test',waitImpl:async()=>{},
  fetchImpl:async(_url,init={})=>{
    if(String(init.method||'GET').toUpperCase()==='POST'){incompatiblePosts+=1;return response({ErrorCode:1});}
    incompatibleProfileReads+=1;return response(profilePayload({final:false,compatible:false}));
  }
});
assert.equal(incompatible.status,'blocked');
assert.equal(incompatiblePosts,0,'Fresh exact-item socket incompatibility must block before every mutation request.');
assert.equal(incompatibleProfileReads,2,'A blocked attempt must still perform its final readback.');

const noTransferPlan=clone(plan);
noTransferPlan.transfers=[];
const transferPhase=noTransferPlan.phases.find(phase=>phase.capability==='transferItems');
transferPhase.required=false;transferPhase.status='skipped';
const noTransferSession={...session,capabilities:{destinyActions:{...session.capabilities.destinyActions,transferItems:false}}};
let dynamicTransferReads=0;
let dynamicTransferPosts=0;
const dynamicTransferBlocked=await executeLiveTransferPlan(confirmLiveTransferPlan(noTransferPlan),{
  session:noTransferSession,authOrigin:'https://auth.test',waitImpl:async()=>{},
  fetchImpl:async(_url,init={})=>{
    if(String(init.method||'GET').toUpperCase()==='POST'){dynamicTransferPosts+=1;return response({ErrorCode:1});}
    dynamicTransferReads+=1;return response(profilePayload({final:false}));
  }
});
assert.equal(dynamicTransferBlocked.status,'blocked','A newly required transfer must block if the current session does not advertise transfer support.');
assert.equal(dynamicTransferPosts,0,'A dynamically required but unadvertised transfer must make zero mutation requests.');
assert.equal(dynamicTransferReads,2,'A dynamically blocked transfer must still perform its final readback.');

const stagedClear=stageBungieLoadoutAction('clear',{characterId:CHARACTER_ID,index:4,loadoutName:'Nightfall'});
let loadoutCalls=0;
await assert.rejects(()=>executeBungieLoadoutAction('clear',{characterId:CHARACTER_ID,index:4,session,confirmation:stagedClear,fetchImpl:async()=>{loadoutCalls+=1;return response({ErrorCode:1});},authOrigin:'https://auth.test'}),/Final user confirmation/);
assert.equal(loadoutCalls,0,'A staged but unconfirmed loadout clear must make zero requests.');
let loadoutRequest=null;
await executeBungieLoadoutAction('clear',{characterId:CHARACTER_ID,index:4,session,confirmation:confirmBungieLoadoutAction(stagedClear),fetchImpl:async(url,init)=>{loadoutRequest={url:String(url),init};return response({ErrorCode:1,Message:'Ok'});},authOrigin:'https://auth.test'});
assert.equal(new URL(loadoutRequest.url).pathname,'/bungie/actions/loadout/clear');
assert.deepEqual(JSON.parse(loadoutRequest.init.body),{membershipType:Number(MEMBERSHIP_TYPE),characterId:CHARACTER_ID,loadoutIndex:4});

console.log('MANUAL_BUILD_EDITOR=PASS');
console.log('PARADOX_NAMED_LOADOUT=PASS');
console.log('GUARDED_LIVE_APPLY=PASS');
console.log('BUNGIE_LOADOUT_CONFIRMATION=PASS');
