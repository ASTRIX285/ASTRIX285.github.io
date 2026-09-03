const BUNGIE_ORIGIN='https://www.bungie.net';

const integer=value=>{
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isInteger(number)&&number>=0?number:null;
};
const values=source=>source instanceof Map?[...source.values()]:Object.values(source||{});
const record=source=>source instanceof Map?Object.fromEntries(source):source||{};
const absoluteIcon=value=>{
  const icon=String(value||'').trim();
  return icon?(icon.startsWith('http')?icon:`${BUNGIE_ORIGIN}${icon}`):'';
};
const definitionHash=(definition,key=null)=>integer(definition?.hash??definition?.bungieHash??key);

function isArtifactItemDefinition(definition){
  const type=String(definition?.itemTypeDisplayName||definition?.itemTypeAndTierDisplayName||'').trim().toLowerCase();
  const sockets=definition?.sockets?.socketEntries;
  return type==='artifact'&&Array.isArray(sockets)&&sockets.some(entry=>integer(entry?.reusablePlugSetHash)!==null||Array.isArray(entry?.reusablePlugItems));
}

function isArtifactPerkDefinition(definition){
  return String(definition?.itemTypeDisplayName||definition?.itemTypeAndTierDisplayName||'').trim().toLowerCase()==='artifact perk';
}

function plugHashes(entry,plugSets){
  const direct=(entry?.reusablePlugItems||[]).map(row=>integer(row?.plugItemHash??row?.plugHash));
  const plugSetHash=integer(entry?.reusablePlugSetHash);
  const plugSet=plugSetHash===null?null:plugSets[String(plugSetHash)];
  const fromSet=(plugSet?.reusablePlugItems||[]).map(row=>integer(row?.plugItemHash??row?.plugHash));
  return [...new Set([...direct,...fromSet].filter(hash=>hash!==null))];
}

function artifactIdentity(definition,hash,manifestVersion){
  const display=definition?.displayProperties||{};
  return {
    hash,
    bungieHash:hash,
    name:String(display.name||`Artifact ${hash}`),
    description:String(display.description||''),
    icon:absoluteIcon(display.icon),
    definition,
    displayResolved:Boolean(display.name),
    unresolved:!display.name,
    availabilityModel:'artifact-2-socket-buckets',
    source:'bungie-current-manifest',
    manifestVersion:manifestVersion||null,
    state:'catalogued',
    provenance:'bungie-artifact-2-manifest'
  };
}

function resolveArtifactTwoCatalog({inventoryDefinitions={},plugSetDefinitions={},manifestVersion=null}={}){
  const inventory=record(inventoryDefinitions);
  const plugSets=record(plugSetDefinitions);
  const candidates=Object.entries(inventory)
    .map(([key,definition])=>({hash:definitionHash(definition,key),definition}))
    .filter(row=>row.hash!==null&&isArtifactItemDefinition(row.definition));

  return candidates.map(({hash,definition})=>{
    const entries=definition?.sockets?.socketEntries||[];
    const grouped=[];
    const byPlugSet=new Map();
    entries.forEach((entry,socketIndex)=>{
      const plugSetHash=integer(entry?.reusablePlugSetHash);
      const directHashes=plugHashes(entry,plugSets);
      if(!directHashes.length)return;
      const groupKey=plugSetHash===null?`socket:${socketIndex}`:`plugset:${plugSetHash}`;
      let group=byPlugSet.get(groupKey);
      if(!group){
        group={groupKey,plugSetHash,socketIndexes:[],perkHashes:[],firstSocketIndex:socketIndex};
        byPlugSet.set(groupKey,group);
        grouped.push(group);
      }
      group.socketIndexes.push(socketIndex);
      group.perkHashes.push(...directHashes);
    });

    const selectionSlots=grouped.map(group=>{
      const perkHashes=[...new Set(group.perkHashes)].filter(perkHash=>isArtifactPerkDefinition(inventory[String(perkHash)]));
      return {...group,perkHashes};
    }).filter(group=>group.perkHashes.length&&group.socketIndexes.length)
      .sort((left,right)=>left.firstSocketIndex-right.firstSocketIndex)
      .map((group,tierIndex)=>({
        tierIndex,
        bucket:tierIndex+1,
        capacity:group.socketIndexes.length,
        socketIndexes:[...group.socketIndexes],
        plugSetHash:group.plugSetHash,
        perkHashes:[...group.perkHashes]
      }));

    if(!selectionSlots.length)return null;
    const perks=selectionSlots.flatMap(slot=>slot.perkHashes.map((perkHash,itemIndex)=>{
      const perkDefinition=inventory[String(perkHash)]||null;
      const display=perkDefinition?.displayProperties||{};
      return {
        hash:perkHash,
        bungieHash:perkHash,
        name:String(display.name||`Artifact perk ${perkHash}`),
        description:String(display.description||''),
        icon:absoluteIcon(display.icon),
        definition:perkDefinition,
        displayResolved:Boolean(display.name&&display.description),
        unresolved:!display.name||!display.description,
        isActive:false,
        isVisible:true,
        tierUnlocked:true,
        tierIndex:slot.tierIndex,
        column:slot.bucket,
        order:itemIndex+1,
        itemIndex,
        tierTitle:`BUCKET ${slot.bucket}`,
        bucketCapacity:slot.capacity,
        plugSetHash:slot.plugSetHash
      };
    })).filter((perk,index,rows)=>rows.findIndex(other=>other.hash===perk.hash&&other.tierIndex===perk.tierIndex)===index);

    return {
      ...artifactIdentity(definition,hash,manifestVersion),
      selectionSlots,
      selectionLimit:selectionSlots.reduce((sum,slot)=>sum+slot.capacity,0),
      perks,
      activePerks:[]
    };
  }).filter(Boolean).sort((left,right)=>left.name.localeCompare(right.name)||left.hash-right.hash);
}

export {isArtifactItemDefinition,isArtifactPerkDefinition,resolveArtifactTwoCatalog};
