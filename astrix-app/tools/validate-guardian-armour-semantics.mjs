#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  ARMOUR_ARCHETYPES,
  classifyArmour,
  isSubclassPlug,
  isInfusionPlug,
  isMasterworkPlug,
  isTuningPlug
} from '../pages/guardian-workspace-v2/guardian-armour-semantics.mjs';

const plug=(hash,name,category,{description='',itemType=19,isDummyPlug=false}={})=>({
  hash,
  name,
  description,
  icon:`/icons/${hash}.png`,
  itemTypeDisplayName:'Armor Mod',
  definition:{itemType,plug:{plugCategoryIdentifier:category,isDummyPlug}}
});

const infusion=plug(1,'Infuse','ui.infusion',{itemType:0,isDummyPlug:true});
const masterwork=plug(2,'Masterwork Level 5','armor.masterwork',{itemType:0});
const generalGrenade=plug(3,'Grenade Kickstart','armor.mods.general',{description:'Improves grenade behaviour.'});
const legArc=plug(4,'Arc Leg Surge','armor.mods.legs');
const legScavenger=plug(5,'Special Ammo Scavenger','armor.mods.legs');
const legRecuperation=plug(6,'Recuperation','armor.mods.legs');
const tuning=plug(7,'Balanced Tuning','armor.tuning');
const bulwark=plug(8,'Bulwark','armor.archetype',{description:'Primary Stat: Health. Secondary Stat: Class.',itemType:0});
const exotic=plug(9,'Close Enough','intrinsics',{description:'Exotic armor perk.',itemType:0});
const shader=plug(10,'Shader','cosmetics.shader',{itemType:0});

assert.equal(isInfusionPlug(infusion),true,'Infusion control must be identified as non-build system state');
assert.equal(isMasterworkPlug(masterwork),true,'Armour Masterwork must be separated from mods');
assert.equal(isTuningPlug(tuning),true,'Tier-5 Tuning slot must be separate from General mods');
assert.equal(isSubclassPlug(generalGrenade),false,'A grenade-related armour mod must not be misclassified as a subclass plug');

assert.deepEqual(ARMOUR_ARCHETYPES.bulwark,{name:'Bulwark',primaryStat:'Health',secondaryStat:'Class'});

const item={
  hash:100,
  name:'Example Exotic Legs',
  tier:'Exotic',
  isExotic:true,
  bucketHash:20886954,
  itemTypeDisplayName:'Leg Armor',
  gearTier:5,
  energy:{energyType:0,energyCapacity:11,energyUsed:11,energyUnused:0},
  intrinsicTrait:exotic,
  definition:{equippingBlock:{equipableItemSetHash:987654}},
  socketCoverage:{
    complete:true,
    plugs:[infusion,masterwork,generalGrenade,legArc,legScavenger,legRecuperation,tuning,bulwark,exotic,shader]
  }
};

const semantic=classifyArmour(item);
assert.equal(semantic.slot,'legs');
assert.equal(semantic.gearTier,5);
assert.equal(semantic.masterwork.level,5);
assert.equal(semantic.masterwork.maxLevel,5);
assert.equal(semantic.masterwork.complete,true);
assert.equal(semantic.archetype.name,'Bulwark');
assert.equal(semantic.archetype.primaryStat,'Health');
assert.equal(semantic.archetype.secondaryStat,'Class');
assert.deepEqual(semantic.generalMods.map(row=>row.hash),[3]);
assert.deepEqual(semantic.tuningMods.map(row=>row.hash),[7]);
assert.deepEqual(semantic.slotMods.map(row=>row.hash),[4,5,6]);
assert.equal(semantic.exoticPerk.hash,9);
assert.equal(semantic.setBonus.setHash,987654);
assert.equal(semantic.setBonus.resolved,false);
assert.deepEqual(semantic.ignoredSystemPlugs.map(row=>row.hash),[1]);
assert.equal(semantic.generalMods.some(row=>row.hash===1),false);
assert.equal(semantic.slotMods.some(row=>row.hash===1),false);
assert.deepEqual(semantic.unknownPlugs,[]);

console.log('PARADOX_ARMOUR_SEMANTICS=PASS');
console.log('INFUSION_EXCLUDED=PASS');
console.log('MASTERWORK_SEPARATE=PASS');
console.log('TUNING_SEPARATE=PASS');
console.log('GRENADE_MOD_NOT_SUBCLASS=PASS');
console.log('ARCHETYPE_MAPPING=PASS');
console.log('EXOTIC_INTRINSIC_SEPARATE=PASS');
console.log('SET_HASH_PRESERVED=PASS');
