#!/usr/bin/env node
import assert from 'node:assert/strict';
import {normalizeObservedBuild,aggregateObservedBuilds} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-observed-build-analytics.mjs';

const item=(hash,name,extra={})=>({hash,name,...extra});
const base={
  source:'current-guardian',characterClass:'Hunter',subclass:'Solar',
  subclassBuild:{super:item(1,'Golden Gun'),aspects:[item(2,'Knock Em Down'),item(3,'On Your Mark')],fragments:[item(4,'Ember A'),item(5,'Ember B')]},
  artifact:{activePerks:[item(6,'Artifact Perk')]},
  weapons:[item(10,'Weapon A'),item(11,'Weapon B'),item(12,'Weapon C')],
  armour:[item(20,'Helmet'),item(21,'Exotic Chest',{isExotic:true})]
};
const second={...base,weapons:[item(10,'Weapon A'),item(13,'Weapon D'),item(12,'Weapon C')]};

const a=normalizeObservedBuild(base,{observedAt:'2026-08-21T18:00:00Z'});
const b=normalizeObservedBuild(second,{observedAt:'2026-08-21T18:01:00Z'});
assert.equal(a.characterClass,'hunter');
assert.equal(a.subclass,'solar');
assert.equal(a.weapons.length,3);
assert.equal(a.armour.find(x=>x.isExotic)?.name,'Exotic Chest');

const analytics=aggregateObservedBuilds([a,b]);
assert.equal(analytics.observationCount,2);
assert.equal(analytics.descriptiveOnly,true);
assert.equal(analytics.rankings.weapons[0].label,'Weapon A');
assert.equal(analytics.rankings.weapons[0].count,2);
assert.equal(analytics.rankings.weapons[0].share,1);
assert.equal(analytics.rankings.exoticArmour[0].count,2);
assert.ok(analytics.rankings.weaponPairs.some(row=>row.label.includes('Weapon A')));
assert.match(analytics.note,/not proof of synergy/i);

console.log('PARADOX_OBSERVED_ANALYTICS=PASS');
console.log('POPULARITY_NOT_SYNERGY=PASS');
console.log('THIRD_PARTY_SCRAPE_REQUIRED=NO');
