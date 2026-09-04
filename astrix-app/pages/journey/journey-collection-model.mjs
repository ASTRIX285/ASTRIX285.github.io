import {paradoxDefinitionId} from '../../core/bungie-item-identity.mjs';
const positive=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
const number=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
const icon=value=>value?new URL(value,'https://www.bungie.net').href:'';

export function collectibleState(profile,characterId,hash){
  const row=profile?.characterCollectibles?.data?.[characterId]?.collectibles?.[String(hash)]??profile?.profileCollectibles?.data?.collectibles?.[String(hash)];
  const state=number(row?.state);
  return {state,complete:state===null?null:(state&1)===0,visible:state===null?null:(state&4)===0,obscured:state!==null&&(state&2)!==0};
}

export async function resolveCollectionBadges(payload,manifest,characterId){
  const profile=payload?.profile||{},rootHash=positive(profile?.profileCollectibles?.data?.collectionBadgesRootNodeHash);
  if(!rootHash)return {badges:[],coverage:{complete:false,reason:'collectibles-component-unavailable',unresolved:[]}};
  const root=await manifest.getAsync('DestinyPresentationNodeDefinition',rootHash);
  if(!root)return {badges:[],coverage:{complete:false,reason:'badge-root-unresolved',unresolved:[rootHash]}};
  const entries=(root.children?.presentationNodes||[]).slice().sort((a,b)=>(a.nodeDisplayPriority||0)-(b.nodeDisplayPriority||0));
  const definitions=await manifest.getMany('DestinyPresentationNodeDefinition',entries.map(e=>e.presentationNodeHash));
  const unresolved=new Set(),unresolvedStates=new Set(),badges=[];
  for(const entry of entries){
    const hash=positive(entry.presentationNodeHash),definition=definitions[String(hash)];
    if(!definition){unresolved.add(hash);continue;}
    const node=profile?.characterPresentationNodes?.data?.[characterId]?.nodes?.[String(hash)]??profile?.profilePresentationNodes?.data?.nodes?.[String(hash)];
    if(number(node?.state)!==null&&(Number(node.state)&1)!==0)continue;
    const seen=new Set(),collectibles=new Map();let pending=[{hash,definition,path:''}];
    while(pending.length){
      const level=pending;pending=[];
      const childHashes=[];
      for(const item of level){
        if(seen.has(item.hash))continue;seen.add(item.hash);
        for(const child of item.definition.children?.collectibles||[])collectibles.set(child.collectibleHash,{...child,path:item.path});
        for(const child of item.definition.children?.presentationNodes||[])childHashes.push(child.presentationNodeHash);
      }
      const children=childHashes.length?await manifest.getMany('DestinyPresentationNodeDefinition',childHashes):{};
      for(const childHash of childHashes){
        const child=children[String(childHash)];
        if(!child){unresolved.add(childHash);continue;}
        pending.push({hash:childHash,definition:child,path:child.displayProperties?.name||''});
      }
    }
    const collectDefs=await manifest.getMany('DestinyCollectibleDefinition',collectibles.keys());
    const requirements=[];
    for(const [collectibleHash,child] of collectibles){
      const def=collectDefs[String(collectibleHash)],state=collectibleState(profile,characterId,collectibleHash);
      if(!def){unresolved.add(collectibleHash);continue;}
      if(state.visible===false)continue;
      if(state.state===null)unresolvedStates.add(collectibleHash);
      const name=state.obscured?'Hidden collectible':def.displayProperties?.name||`Collectible ${collectibleHash}`;
      requirements.push({hash:collectibleHash,paradoxId:paradoxDefinitionId('DestinyCollectibleDefinition',collectibleHash),itemHash:def.itemHash??null,name:child.path?`${child.path} · ${name}`:name,icon:state.obscured?'':icon(def.displayProperties?.icon),description:state.obscured?'':def.sourceString||def.displayProperties?.description||'',complete:state.complete,objectives:[],state:state.state});
    }
    const known=requirements.every(row=>row.complete!==null),completed=number(node?.progressValue)??(known?requirements.filter(row=>row.complete).length:null),total=number(node?.completionValue)??(requirements.length||null);
    badges.push({hash,paradoxId:paradoxDefinitionId('DestinyPresentationNodeDefinition',hash),name:definition.displayProperties?.name||`Badge ${hash}`,icon:icon(definition.displayProperties?.icon||definition.originalIcon),description:definition.displayProperties?.description||'',completed,total,unit:'COLLECTIBLES',complete:completed!==null&&total>0&&completed>=total,requirements,characterId,source:'Bungie Collectibles / collectionBadgesRootNodeHash'});
  }
  return {badges,coverage:{rootHash,complete:unresolved.size===0&&unresolvedStates.size===0,unresolved:[...unresolved],unresolvedStates:[...unresolvedStates],badgeCount:badges.length,source:'Destiny2.GetProfile components 700 and 800'}};
}
