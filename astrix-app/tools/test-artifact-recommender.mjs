import fs from 'node:fs/promises';
import {recommendArtifactPerks,resolveBuildWeapons} from '../pages/guardian-workspace-v2/guardian-artifact-recommender.mjs';
import {resolveArtifactByProvenance} from '../pages/guardian-workspace-v2/guardian-artifact-provenance.mjs';
const d='astrix-app/data/paradox-forge/beta/';
const artifact=JSON.parse(await fs.readFile(d+'beta-current-artifact.json','utf8'));
const fixtures=JSON.parse(await fs.readFile(d+'ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json','utf8'));
const hashes=[4019651319,2965080304,17096506];
const manifest={inventoryItems:{
  '4019651319':{itemType:3,weaponType:'Hand Cannon',element:'Solar',display:{name:'Test Hand Cannon'}},
  '2965080304':{itemType:3,weaponType:'Sniper Rifle',element:'Arc',display:{name:'Test Sniper Rifle'}},
  '17096506':{itemType:3,weaponType:'Machine Gun',element:'Void',display:{name:'Test Machine Gun'}}
}};
const resolved=resolveBuildWeapons(hashes,manifest);if(resolved.unresolved.length)throw new Error('unresolved weapons '+resolved.unresolved);
const build={subclass:{name:'Gunslinger',element:'Solar'},weapons:resolved.weapons};
const fixtureResult=recommendArtifactPerks(build,artifact,{currentSeasonNumber:28});
if(fixtureResult.status!=='current'||!fixtureResult.recommendations.length)throw new Error('fixture recommendations missing '+JSON.stringify(fixtureResult));
if(JSON.stringify(fixtureResult)!==JSON.stringify(recommendArtifactPerks(build,artifact,{currentSeasonNumber:28})))throw new Error('non-deterministic');
const fixture=fixtures.fixtures.find(x=>x.fixtureId==='PF-BETA-01');if(!fixture||fixture.artifactSeason!==null)throw new Error('fixture contract changed');
const defs={'123':{displayProperties:{name:'Verified Active Perk',icon:'/common/destiny2_content/icons/test.png'}}};
const livePayload={profile:{profileProgression:{data:{seasonalArtifact:{artifactHash:999}}},characterProgressions:{data:{'cid-live':{seasonalArtifact:{tiers:[{items:[{itemHash:123,isActive:true,isVisible:true}]}]}}}}},definitions:defs,artifactDefinition:{hash:999,displayProperties:{name:'Test Artifact'}}};
const live=resolveArtifactByProvenance(livePayload,'cid-live');if(live.state!=='resolved'||live.activePerks.length!==1||live.activePerks[0].hash!==123)throw new Error('live active resolution failed '+JSON.stringify(live));
if(live.artifactConfiguration?.artifactHash!==999||live.artifactConfiguration?.selectedPerkHashes?.[0]!==123||live.artifactConfiguration?.provenance?.component!==202)throw new Error('live artifactConfiguration provenance failed '+JSON.stringify(live.artifactConfiguration));
const nonePayload=structuredClone(livePayload);nonePayload.profile.characterProgressions.data['cid-live'].seasonalArtifact.tiers[0].items[0].isActive=false;
const none=resolveArtifactByProvenance(nonePayload,'cid-live');if(none.state!=='none-active'||none.activePerks.length)throw new Error('none-active failed '+JSON.stringify(none));
const bad=resolveArtifactByProvenance(livePayload,'cid-missing');if(bad.state!=='state-unavailable'||bad.activePerks!==null||bad.artifactConfiguration?.selectedPerkHashes!==null)throw new Error('bad character fallback '+JSON.stringify(bad));
const shared=resolveArtifactByProvenance({profile:{profileProgression:{data:{seasonalArtifact:{artifactHash:999}}}},artifactDefinition:{hash:999,displayProperties:{name:'Test Artifact'}}},'cid-live');if(shared.state!=='state-unavailable'||shared.activePerks!==null)throw new Error('share provenance failed '+JSON.stringify(shared));
const unresolvedPayload=structuredClone(livePayload);unresolvedPayload.profile.characterProgressions.data['cid-live'].seasonalArtifact.tiers[0].items[0].itemHash=456;
const unresolved=resolveArtifactByProvenance(unresolvedPayload,'cid-live');if(unresolved.activePerks[0].name!==''||unresolved.unresolvedPerkHashes[0]!==456)throw new Error('unresolved manifest display must not be invented '+JSON.stringify(unresolved));
console.log('FIXTURE_RECOMMENDATIONS='+JSON.stringify({fixtureId:fixture.fixtureId,state:'state-unavailable',recommendationCount:fixtureResult.recommendations.length,recommendations:fixtureResult.recommendations}));
console.log('LIVE_ACTIVE='+JSON.stringify({state:live.state,provenance:live.provenance,activePerks:live.activePerks.map(x=>({hash:x.hash,name:x.name}))}));
console.log('LIVE_NONE_ACTIVE='+JSON.stringify({state:none.state,activePerks:none.activePerks}));
console.log('BAD_CHARACTER='+JSON.stringify({state:bad.state,message:bad.stateMessage,activePerks:bad.activePerks}));
console.log('SHARE_FIXTURE='+JSON.stringify({state:shared.state,message:shared.stateMessage}));
