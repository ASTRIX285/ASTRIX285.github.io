const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const positive=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
// Official English world-manifest root, verified against its returned definition.
// Profile-provided hashes always take precedence; no progress comes from this ID.
export const RECORD_CATALOGUE_ROOT=1163735237;
export async function resolveRecordTree(payload,manifest,characterId=''){
  const profile=payload?.profile||{};
  const nodes={...(profile.profilePresentationNodes?.data?.nodes||{}),...(profile.characterPresentationNodes?.data?.[characterId]?.nodes||{})};
  let hash=positive(profile.profileRecords?.data?.recordCategoriesRootNodeHash)||RECORD_CATALOGUE_ROOT;
  let definition=await manifest.getAsync('DestinyPresentationNodeDefinition',hash);
  if(!definition)return null;
  const seen=new Set([String(hash)]);
  // Some profiles supply the inner current-Triumphs root. Walk the explicit
  // parents to recover its sibling Medals/Lore/Catalysts branches.
  for(let depth=0;depth<8;depth++){
    const parents=(definition.parentNodeHashes||[]).filter(h=>!seen.has(String(h)));
    if(!parents.length)break;
    const definitions=await manifest.getMany('DestinyPresentationNodeDefinition',parents);
    const parent=parents.map(h=>definitions[h]).find(row=>key(row?.displayProperties?.name)==='triumphs');
    if(!parent)break;
    hash=parent.hash;definition=parent;seen.add(String(hash));
  }
  const entries=(definition.children?.presentationNodes||[]).slice().sort((a,b)=>(a.nodeDisplayPriority||0)-(b.nodeDisplayPriority||0));
  const definitions=await manifest.getMany('DestinyPresentationNodeDefinition',entries.map(e=>e.presentationNodeHash));
  const roots=entries.map(entry=>({entry,hash:String(entry.presentationNodeHash),definition:definitions[entry.presentationNodeHash],node:nodes[entry.presentationNodeHash]})).filter(row=>row.definition);
  const root={hash:String(hash),definition,node:nodes[hash]};
  return {...root,nodes,roots,triumphs:roots.find(row=>key(row.definition.displayProperties?.name)==='triumphs')||(key(definition.displayProperties?.name)==='triumphs'?root:null)};
}
export function patternTypeKey(path){
  for(const name of path||[]){const type=key(name).replace(/-weapon-patterns$/,'');if(['primary','special','heavy'].includes(type))return type;}
  return null;
}
export function seasonRankProgress(payload,characterId,metadata){
  const progressions={...(payload?.profile?.profileProgression?.data?.progressions||{}),...(payload?.profile?.characterProgressions?.data?.[characterId]?.progressions||{})};
  const reward=progressions[String(metadata?.pass?.rewardProgressionHash||'')];
  const prestige=progressions[String(metadata?.pass?.prestigeProgressionHash||'')];
  const direct=progressions[String(metadata?.season?.seasonPassProgressionHash||'')];
  const active=prestige&&(Number(prestige.level)>0||reward&&Number(reward.level)>=Number(reward.levelCap))?prestige:(reward||direct);
  const level=row=>row?.level!==null&&row?.level!==undefined&&Number.isFinite(Number(row.level))?Number(row.level):null;
  const rewardLevel=level(reward),prestigeLevel=level(prestige);
  return {active,rank:rewardLevel!==null||prestigeLevel!==null?(rewardLevel??0)+(prestigeLevel??0):level(active)};
}
export async function findDestinationNodes(root,manifest,matches,nodes={}){
  if(!root)return [];
  const found=[];const seen=new Set();let pending=[{presentationNodeHash:root.hash}];
  while(pending.length){
    const level=pending;pending=[];
    const definitions=await manifest.getMany('DestinyPresentationNodeDefinition',level.map(e=>e.presentationNodeHash));
    for(const entry of level){
      const hash=String(entry.presentationNodeHash);if(seen.has(hash))continue;seen.add(hash);
      const definition=definitions[hash];if(!definition||(Number(nodes[hash]?.state||0)&1))continue;
      if(matches(definition.displayProperties?.name)){found.push({entry,hash,definition,node:nodes[hash]});continue;}
      pending.push(...(definition.children?.presentationNodes||[]));
    }
  }
  return found;
}
