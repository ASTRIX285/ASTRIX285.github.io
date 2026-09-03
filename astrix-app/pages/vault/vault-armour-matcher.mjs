const ARMOUR_STAT_KEYS=Object.freeze(['health','melee','grenade','super','class','weapon']);
const ARMOUR_STAT_LABELS=Object.freeze({health:'Health',melee:'Melee',grenade:'Grenade',super:'Super',class:'Class',weapon:'Weapon'});
const STAT_ALIASES=Object.freeze({
  health:['health'],
  melee:['melee'],
  grenade:['grenade'],
  super:['super'],
  class:['class','classability'],
  weapon:['weapon','weapons']
});

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const normalise=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
const emptyVector=()=>Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,0]));
const armourSetHash=item=>{
  const value=item?.setBonus?.hash??item?.armourSemantics?.set?.hash??item?.definition?.equipableItemSetHash??item?.definition?.equippingBlock?.equipableItemSetHash;
  const hash=Number(value);
  return Number.isInteger(hash)&&hash>0?hash:null;
};

function setRequirements(options={}){
  const rows=Array.isArray(options.setSelections)?options.setSelections:[];
  const unique=new Map();
  for(const row of rows){
    const hash=Number(row?.setHash??row?.hash);
    const count=Number(row?.count??row?.requiredSetCount);
    if(Number.isInteger(hash)&&hash>0&&(count===2||count===4))unique.set(hash,Math.max(unique.get(hash)||0,count));
  }
  return [...unique].map(([hash,count])=>({hash,count})).sort((left,right)=>left.hash-right.hash);
}

function constrainedGroups(items=[],options={}){
  const fixedExoticHash=Number(options.fixedExoticHash);
  const hasFixedExotic=Number.isInteger(fixedExoticHash)&&fixedExoticHash>0;
  const groups=Array.from({length:5},()=>[]);
  for(const item of Array.isArray(items)?items:[]){
    const slot=Number(item?.slotIndex);
    if(!Number.isInteger(slot)||slot<0||slot>=groups.length)continue;
    const itemHash=Number(item?.itemHash??item?.hash);
    if(hasFixedExotic){
      if(item?.isExotic&&itemHash!==fixedExoticHash)continue;
      if(!item?.isExotic&&slot===Number(options.fixedExoticSlot))continue;
      if(item?.isExotic&&slot!==Number(options.fixedExoticSlot))continue;
    }
    groups[slot].push({item,stats:armourStatVector(item),setHash:armourSetHash(item)});
  }
  return groups;
}

function countSignature(counts=[],requirements=[]){return requirements.map((row,index)=>`${row.hash}:${Math.min(row.count,Number(counts[index]||0))}`).join('|');}

function canCompleteSetRequirements(groups,nextSlot,counts,requirements,memo=new Map()){
  if(!requirements.length)return true;
  if(nextSlot>=groups.length)return requirements.every((row,index)=>Number(counts[index]||0)>=row.count);
  const key=`${nextSlot}:${countSignature(counts,requirements)}`;
  if(memo.has(key))return memo.get(key);
  const hashes=[...new Set(groups[nextSlot].map(row=>row.setHash??0))];
  for(const hash of hashes){
    const next=counts.slice();
    const index=requirements.findIndex(row=>row.hash===hash);
    if(index>=0)next[index]=Math.min(requirements[index].count,Number(next[index]||0)+1);
    if(canCompleteSetRequirements(groups,nextSlot+1,next,requirements,memo)){memo.set(key,true);return true;}
  }
  memo.set(key,false);
  return false;
}

function statKey(name){
  const candidate=normalise(name);
  return ARMOUR_STAT_KEYS.find(key=>STAT_ALIASES[key].includes(candidate))||null;
}

function armourStatVector(item={}){
  const vector=emptyVector();
  for(const stat of Array.isArray(item?.stats)?item.stats:[]){
    const key=statKey(stat?.name);
    if(key)vector[key]+=finite(stat?.value);
  }
  return vector;
}

function addVectors(left={},right={}){
  return Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,finite(left[key])+finite(right[key])]));
}

function normaliseTargets(targets={}){
  return Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,Math.max(0,Math.round(finite(targets[key])))]));
}

function armourTargetMaximums(items=[],options={}){
  const groups=constrainedGroups(items,options);
  const requirements=setRequirements(options);
  if(groups.some(group=>group.length===0))return emptyVector();
  return Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>{
    let legal=new Map([[`0:${requirements.map(()=>0).join(',')}`,{exoticCount:0,counts:requirements.map(()=>0),value:0}]]);
    for(const rows of groups){
      const next=new Map();
      for(const state of legal.values())for(const row of rows){
        const exoticCount=state.exoticCount+(row.item?.isExotic?1:0);
        if(exoticCount>1)continue;
        const counts=state.counts.slice();
        const requirementIndex=requirements.findIndex(requirement=>requirement.hash===row.setHash);
        if(requirementIndex>=0)counts[requirementIndex]=Math.min(requirements[requirementIndex].count,counts[requirementIndex]+1);
        const signature=`${exoticCount}:${counts.join(',')}`;
        const value=state.value+finite(row.stats[key]);
        if(!next.has(signature)||next.get(signature).value<value)next.set(signature,{exoticCount,counts,value});
      }
      legal=next;
    }
    const values=[...legal.values()].filter(state=>requirements.every((row,index)=>state.counts[index]>=row.count)).map(state=>state.value);
    return [key,Math.max(0,...values)];
  }));
}

function scoreArmourStats(stats={},targets={}){
  const requested=normaliseTargets(targets);
  const active=ARMOUR_STAT_KEYS.filter(key=>requested[key]>0);
  let shortfall=0,overshoot=0,distance=0;
  for(const key of active){
    const delta=finite(stats[key])-requested[key];
    if(delta<0)shortfall+=Math.abs(delta);else overshoot+=delta;
    distance+=Math.abs(delta);
  }
  const total=ARMOUR_STAT_KEYS.reduce((sum,key)=>sum+finite(stats[key]),0);
  return {active,met:active.length>0&&shortfall===0,shortfall,overshoot,distance,total,rank:shortfall*1_000_000+distance*1_000-total};
}

function matchArmourBuilds(items=[],targets={},options={}){
  const requested=normaliseTargets(targets);
  if(!ARMOUR_STAT_KEYS.some(key=>requested[key]>0))return [];
  const limit=Math.max(1,Math.min(20,Math.round(finite(options.limit)||5)));
  const beamLimit=Math.max(100,Math.min(10000,Math.round(finite(options.beamLimit)||2500)));
  const groups=constrainedGroups(items,options);
  const requirements=setRequirements(options);
  if(groups.some(group=>group.length===0))return [];
  if(!canCompleteSetRequirements(groups,0,requirements.map(()=>0),requirements))return [];
  const remaining=Array.from({length:groups.length+1},emptyVector);
  for(let slot=groups.length-1;slot>=0;slot--){
    const slotMaximum=Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,Math.max(0,...groups[slot].map(row=>row.stats[key]))]));
    remaining[slot]=addVectors(slotMaximum,remaining[slot+1]);
  }
  const partialRank=(state,nextSlot)=>{
    let optimisticShortfall=0,lockedOvershoot=0;
    for(const key of ARMOUR_STAT_KEYS.filter(name=>requested[name]>0)){
      optimisticShortfall+=Math.max(0,requested[key]-state.stats[key]-remaining[nextSlot][key]);
      lockedOvershoot+=Math.max(0,state.stats[key]-requested[key]);
    }
    const total=ARMOUR_STAT_KEYS.reduce((sum,key)=>sum+state.stats[key],0);
    return optimisticShortfall*1_000_000+lockedOvershoot*1_000-total;
  };
  let beam=[{items:[],stats:emptyVector(),exoticCount:0,setCounts:requirements.map(()=>0),signature:''}];
  for(let slot=0;slot<groups.length;slot++){
    const next=[];
    for(const state of beam)for(const row of groups[slot]){
      const exoticCount=state.exoticCount+(row.item?.isExotic?1:0);
      if(exoticCount>1)continue;
      const setCounts=state.setCounts.slice();
      const requirementIndex=requirements.findIndex(requirement=>requirement.hash===row.setHash);
      if(requirementIndex>=0)setCounts[requirementIndex]=Math.min(requirements[requirementIndex].count,setCounts[requirementIndex]+1);
      if(!canCompleteSetRequirements(groups,slot+1,setCounts,requirements))continue;
      const id=String(row.item?.itemInstanceId||row.item?.itemHash||row.item?.hash||'');
      const candidate={items:[...state.items,row.item],stats:addVectors(state.stats,row.stats),exoticCount,setCounts,signature:`${state.signature}|${id}`};
      candidate.partialRank=partialRank(candidate,slot+1);
      next.push(candidate);
    }
    next.sort((left,right)=>left.partialRank-right.partialRank||left.signature.localeCompare(right.signature));
    beam=next.slice(0,beamLimit);
  }
  return beam.map(candidate=>({...candidate,score:scoreArmourStats(candidate.stats,requested)}))
    .sort((left,right)=>left.score.rank-right.score.rank||left.signature.localeCompare(right.signature))
    .slice(0,limit);
}

export {ARMOUR_STAT_KEYS,ARMOUR_STAT_LABELS,armourSetHash,armourStatVector,armourTargetMaximums,matchArmourBuilds,normaliseTargets,scoreArmourStats,setRequirements,statKey};
