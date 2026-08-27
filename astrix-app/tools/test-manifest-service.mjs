import assert from 'node:assert/strict';
import {COMPONENT_TYPES,GuardianManifestService} from '../pages/guardian-workspace-v2/guardian-manifest-service.mjs';

class MemoryStorage{
  available=true;
  records=new Map();
  async readCurrent(){return this.records.get('current')||null;}
  async readTable(version,type){return this.records.get(`${version}:${type}`)||null;}
  async writeTable(version,type,definitions){this.records.set(`${version}:${type}`,{version,type,definitions});return true;}
  async commitVersion(version){this.records.set('current',{version,types:[...COMPONENT_TYPES]});return true;}
  async removeOtherVersions(version){for(const key of this.records.keys())if(key!=='current'&&!key.startsWith(`${version}:`))this.records.delete(key);return true;}
}

const tables={
  DestinyInventoryItemDefinition:{
    '100':{hash:100,itemType:3,displayProperties:{name:'Freshly Rolled Weapon',icon:'/weapon.png',description:'Weapon definition'},sockets:{socketEntries:[{singleInitialItemHash:201,reusablePlugItems:[{plugItemHash:202}]}],socketCategories:[{socketCategoryHash:500,socketIndexes:[0]}]},perks:[{perkHash:900}]},
    '201':{hash:201,displayProperties:{name:'Rolled Perk',icon:'/perk.png',description:'Real rolled perk'}},
    '202':{hash:202,displayProperties:{name:'Alternative Perk',icon:'/alternate.png',description:'Real alternative perk'}},
    '203':{hash:203,displayProperties:{},perks:[{perkHash:900}]},
    '300':{hash:300,displayProperties:{name:'Active Artifact Perk',icon:'/artifact-perk.png',description:'Real artifact perk'}}
  },
  DestinySandboxPerkDefinition:{'900':{hash:900,displayProperties:{name:'Sandbox Effect',description:'Sandbox effect description'}}},
  DestinyArtifactDefinition:{'700':{hash:700,displayProperties:{name:'Current Artifact',icon:'/artifact.png'},tiers:[{items:[{itemHash:300}]}]}},
  DestinyStatDefinition:{'600':{hash:600,displayProperties:{name:'Guardian Stat',icon:'/stat.png'}}},
  DestinySocketCategoryDefinition:{'500':{hash:500,displayProperties:{name:'Weapon Perks',description:'Weapon perk sockets'}}}
};

let version='v1';
const componentCalls=[];
const definitionCalls=[];
const fetchImpl=async input=>{
  const url=new URL(String(input));
  if(url.pathname==='/bungie/manifest')return Response.json({version,jsonWorldComponentContentPaths:{en:Object.fromEntries(COMPONENT_TYPES.map(type=>[type,`/${type}.json`]))}});
  if(url.pathname==='/bungie/manifest/component'){
    const type=url.searchParams.get('type');
    componentCalls.push(`${version}:${type}`);
    return new Response(JSON.stringify(tables[type]),{headers:{'Content-Type':'application/json','Content-Length':String(JSON.stringify(tables[type]).length)}});
  }
  if(url.pathname==='/bungie/manifest/definition'){
    const type=url.searchParams.get('type'),hash=url.searchParams.get('hash');
    definitionCalls.push(`${type}:${hash}`);
    return Response.json({type,hash:Number(hash),definition:{hash:Number(hash),displayProperties:{name:`Live definition ${hash}`,icon:'/live.png'}}});
  }
  return new Response(null,{status:404});
};

const storage=new MemoryStorage();
const first=new GuardianManifestService({fetchImpl,storage,authOrigin:'https://auth.test'});
await first.ready();
assert.equal(first.status().mode,'indexeddb');
assert.equal(first.status().versionMatched,false);
assert.equal(componentCalls.length,5,'first version must download all five component tables');
assert.equal(first.identity(201).name,'Rolled Perk');
assert.equal(first.identity(201).icon,'https://www.bungie.net/perk.png');
assert.equal(first.identity(203).name,'Sandbox Effect');

const payload={
  profile:{
    characterEquipment:{data:{c1:{items:[{itemHash:100,itemInstanceId:'weapon-1'}]}}},
    itemComponents:{sockets:{data:{'weapon-1':{sockets:[{plugHash:201}]}}},reusablePlugs:{data:{'weapon-1':{plugs:{'0':[{plugItemHash:202}]}}}}},
    characterProgressions:{data:{c1:{seasonalArtifact:{tiers:[{items:[{itemHash:300,isActive:true,isVisible:true}]}]}}}},
    profileProgression:{data:{seasonalArtifact:{artifactHash:700}}},
    characters:{data:{c1:{stats:{600:25}}}}
  }
};
await first.hydratePayload(payload);
assert.equal(payload.definitions['201'].displayProperties.name,'Rolled Perk');
assert.equal(payload.definitions['202'].displayProperties.name,'Alternative Perk');
assert.equal(payload.definitions['300'].displayProperties.name,'Active Artifact Perk');
assert.equal(payload.definitions['100'].resolvedSandboxPerks[0].displayProperties.name,'Sandbox Effect');
assert.equal(payload.socketCategoryDefinitions['500'].displayProperties.name,'Weapon Perks');
assert.equal(payload.artifactDefinition.displayProperties.name,'Current Artifact');
assert.equal(payload.definitionCoverage.complete,true);
assert.equal(first.get('DestinyInventoryItemDefinition',999999),null,'missing definitions must remain unresolved');

const second=new GuardianManifestService({fetchImpl,storage,authOrigin:'https://auth.test'});
await second.ready();
assert.equal(second.status().versionMatched,true);
assert.equal(componentCalls.length,5,'matching version must skip every component download');

version='v2';
const third=new GuardianManifestService({fetchImpl,storage,authOrigin:'https://auth.test'});
await third.ready();
assert.equal(third.status().version,'v2');
assert.equal(componentCalls.length,10,'new version must download the five component tables once');

const fallback=new GuardianManifestService({fetchImpl,storage:{available:false},authOrigin:'https://auth.test'});
await fallback.ready();
assert.equal(fallback.status().mode,'live-fallback');
assert.equal((await fallback.getAsync('DestinyInventoryItemDefinition',1234)).displayProperties.name,'Live definition 1234');
assert.equal(fallback.get('DestinyInventoryItemDefinition',1234).displayProperties.name,'Live definition 1234');
assert.deepEqual(definitionCalls,['DestinyInventoryItemDefinition:1234']);

console.log(`MANIFEST_FIRST_DOWNLOAD=${componentCalls.slice(0,5).join(',')}`);
console.log('MANIFEST_VERSION_MATCH_SKIP=PASS componentDownloads=0');
console.log(`MANIFEST_VERSION_CHANGE_DOWNLOAD=${componentCalls.slice(5).join(',')}`);
console.log('MANIFEST_LOCAL_ROLL_RESOLUTION=PASS weapon=Freshly Rolled Weapon perk=Rolled Perk alternative=Alternative Perk');
console.log('MANIFEST_ARTIFACT_RESOLUTION=PASS artifact=Current Artifact activePerk=Active Artifact Perk');
console.log('MANIFEST_INDEXEDDB_FALLBACK=PASS source=bungie-single-definition-endpoint');
