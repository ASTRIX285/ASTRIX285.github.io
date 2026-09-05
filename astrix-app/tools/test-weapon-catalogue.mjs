import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {paradoxDefinitionId,resolveItemWatermark,WEAPON_SOCKET_CATEGORIES} from '../core/bungie-item-identity.mjs';
import {normaliseWeaponSemantics,classifyWeaponPlug} from '../pages/guardian-workspace-v2/guardian-semantic-resolver.mjs';

const root=new URL('../data/weapon-catalogue/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const index=await read('index.json');
const report=await read('../paradox-weapon-audit-report.json');
assert.equal(index.manifestVersion,report.manifestVersion);
const components={};
for(const [name,files] of Object.entries(index.components)){
  components[name]={};
  for(const file of files){const payload=await read(file);assert.equal(payload.manifestVersion,index.manifestVersion);Object.assign(components[name],payload[name]);}
}
for(const file of index.files){
  const data=await readFile(new URL(file.path.split('/').at(-1),root));
  assert.equal(data.length,file.bytes);
  assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,`${file.path} content digest`);
}
export const weapons={};
const typeCounts={};
for(const type of index.weaponTypes){
  const payload=await read(type.file);assert.equal(payload.manifestVersion,index.manifestVersion);
  assert.equal(Object.keys(payload.weapons).length,type.weapons);
  for(const [hash,weapon] of Object.entries(payload.weapons)){
    assert.equal(Number(hash),weapon.hash);assert.equal(weapon.itemType,3);
    assert.equal(weapon.itemSubType,type.itemSubType);assert.equal(weapon.weaponType,type.label);
    assert.equal(weapon.paradoxId,paradoxDefinitionId('DestinyInventoryItemDefinition',hash));
    assert.ok(!weapons[hash],`duplicate weapon identity ${hash}`);weapons[hash]=weapon;
  }
  typeCounts[type.label]=type.weapons;
}
assert.equal(Object.keys(weapons).length,index.counts.weapons);
assert.equal(Object.keys(typeCounts).length,index.counts.weaponTypes);
assert.ok(typeCounts['Auto-Rifle']&&typeCounts['Hand Cannon']);
let checkedSockets=0,checkedPoolReferences=0,checkedModels=0;
const classificationPairs=new Set();
export function catalogueItem(weapon){
  const layout=components.socketLayouts[weapon.socketLayoutKey];assert.ok(layout);
  const entries=layout.socketEntryKeys.map(key=>components.socketEntries[key]);
  const definition={...weapon,sockets:{...layout,socketEntries:entries}};
  const plugs=entries.map((entry,socketIndex)=>{
    const hash=entry.singleInitialItemHash,plug=components.plugDefinitions[String(hash)];
    if(!hash||!plug)return null;
    const category=layout.socketCategories.find(row=>row.socketIndexes.includes(socketIndex));
    return {hash,bungieHash:hash,...plug.displayProperties,itemTypeDisplayName:plug.itemTypeDisplayName,definition:plug,socketIndex,socketCategoryHash:category?.socketCategoryHash,socketCategoryDefinition:components.socketCategoryDefinitions[String(category?.socketCategoryHash)],isVisible:entry.defaultVisible!==false,isEnabled:true};
  }).filter(Boolean);
  const weaponSemantics=normaliseWeaponSemantics({item:{itemHash:weapon.hash},itemDefinition:definition,plugs,isExotic:weapon.inventory?.tierType===6});
  return {hash:weapon.hash,bungieHash:weapon.hash,paradoxId:weapon.paradoxId,...weapon.displayProperties,weaponType:weapon.weaponType,definition,power:null,isExotic:weapon.inventory?.tierType===6,weaponSemantics};
}
for(const weapon of Object.values(weapons)){
  const layout=components.socketLayouts[weapon.socketLayoutKey],model=catalogueItem(weapon);
  const entries=layout.socketEntryKeys.map(key=>components.socketEntries[key]);
  for(const socket of weapon.socketCatalogue){
    checkedSockets++;const entry=entries[socket.socketIndex];assert.ok(entry);
    if(entry.socketTypeHash)assert.ok(components.socketTypeDefinitions[String(entry.socketTypeHash)]);
    const pool=new Set([entry.singleInitialItemHash,...(entry.reusablePlugItems||[]).map(p=>p.plugItemHash)].filter(Boolean));
    for(const hash of [entry.reusablePlugSetHash,entry.randomizedPlugSetHash].filter(Boolean)){
      const set=components.plugSetDefinitions[String(hash)];assert.ok(set,`missing set ${hash}`);
      set.reusablePlugItems.forEach(p=>pool.add(p.plugItemHash));
    }
    assert.equal(pool.size,socket.poolSize);
    const category=layout.socketCategories.find(row=>row.socketIndexes.includes(socket.socketIndex));
    for(const hash of pool){
      const plug=components.plugDefinitions[String(hash)];assert.ok(plug,`${weapon.hash}/${socket.socketIndex} missing ${hash}`);checkedPoolReferences++;
      const pair=`${category?.socketCategoryHash}:${hash}`;
      if(!classificationPairs.has(pair)){
        classificationPairs.add(pair);
        const role=classifyWeaponPlug({hash,name:plug.displayProperties?.name,description:plug.displayProperties?.description,definition:plug,socketCategoryHash:category?.socketCategoryHash});
        if(socket.section==='perks')assert.equal(role,'perk',`${hash} misclassified in weapon ${weapon.hash}`);
        if(socket.section==='intrinsic')assert.equal(role,'intrinsic');
        if(socket.section==='mods')assert.ok(['weapon-mod','masterwork','catalyst','infuse'].includes(role));
      }
    }
    if(socket.section==='perks'&&entry.singleInitialItemHash&&entry.defaultVisible!==false)assert.ok(model.weaponSemantics.selectedPerks.some(p=>p.socketIndex===socket.socketIndex),`weapon ${weapon.hash} lost perk socket ${socket.socketIndex}`);
  }
  for(const hash of weapon.archetypePlugHashes)assert.ok(components.plugDefinitions[String(hash)]);
  checkedModels++;
}
for(const [hash,plug] of Object.entries(components.plugDefinitions)){
  assert.equal(Number(hash),plug.hash);assert.equal(plug.paradoxId,paradoxDefinitionId('DestinyInventoryItemDefinition',hash));
  for(const perk of plug.perks||[])assert.ok(components.sandboxPerks[String(perk.perkHash)],`missing sandbox effect ${perk.perkHash}`);
  const iconHash=plug.displayProperties?.iconHash;if(iconHash)assert.ok(components.iconDefinitions[String(iconHash)],`missing icon definition ${iconHash}`);
}
const blade=catalogueItem(weapons['3049715579']);
assert.equal(blade.name,'Praxic Blade');
for(const hash of [3514694513,1958555234,458552176,640727985,2302094943])assert.ok(blade.weaponSemantics.selectedPerks.some(p=>p.hash===hash),`missing Praxic perk ${hash}`);
assert.ok(blade.weaponSemantics.modSockets.some(p=>p.hash===1742690744),'Praxic form belongs in Weapon Mods');
assert.ok(blade.weaponSemantics.modSockets.some(p=>p.hash===2287797791),'Praxic upgrade belongs in Weapon Mods');
const options=[1,2,3,4,5].map(hash=>({hash,name:`Fixture ${hash}`,socketIndex:1,socketCategoryHash:WEAPON_SOCKET_CATEGORIES.perks,definition:{plug:{plugCategoryIdentifier:'frames'}}}));
const expanded=normaliseWeaponSemantics({plugs:[options[4]],instance:{gearTier:1},alternativeColumns:{1:options}});
assert.equal(expanded.perkModel.columns[0].options.length,5,'Real alternatives must never be truncated to tier capacity');
assert.equal(expanded.perkRows.length,5);
assert.ok(expanded.perkRows[4].slots[0].isSelected);
const versioned={hash:100,iconWatermark:'/original.png',quality:{currentVersion:2,versions:[{},{},{}],displayVersionWatermarkIcons:['/v0.png','/v1.png','/v2.png']}};
assert.equal(resolveItemWatermark({versionNumber:1},versioned).path,'/v1.png');
assert.equal(resolveItemWatermark({},versioned).path,'/v2.png');
assert.equal(resolveItemWatermark({versionNumber:0},versioned).path,'/v0.png');
assert.equal(resolveItemWatermark({versionNumber:0},{...versioned,isFeaturedItem:true,iconWatermarkFeatured:'/featured.png'}).path,'/featured.png');
assert.equal(resolveItemWatermark({},{}).status,'not-provided');
assert.equal(checkedSockets,index.counts.weaponSockets);
assert.equal(checkedModels,index.counts.weapons);
assert.equal(report.unresolvedReferences.length,0);
console.log(JSON.stringify({WEAPON_CATALOGUE:'PASS',manifestVersion:index.manifestVersion,weaponTypes:typeCounts,checkedModels,checkedSockets,checkedPoolReferences,classificationPairs:classificationPairs.size,iconDefinitions:Object.keys(components.iconDefinitions).length}));
if(process.argv.includes('--record')){
  report.validation={...report.validation,catalogue:'pass',weaponModels:'pass',allPoolReferences:'pass',iconDefinitionReferences:'pass',watermarkVersionSelection:'pass',checkedModels,checkedSockets,checkedPoolReferences};
  await writeFile(new URL('../paradox-weapon-audit-report.json',root),JSON.stringify(report)+'\n');
}
