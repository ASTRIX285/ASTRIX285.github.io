const ARMOUR_STAT_KEYS=Object.freeze(['health','melee','grenade','super','class','weapon']);
const ARMOUR_STAT_LABELS=Object.freeze({health:'Health',melee:'Melee',grenade:'Grenade',super:'Super',class:'Class',weapon:'Weapon'});
const ARMOUR_STAT_CAP=200;
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
  const fixedExoticHashes=new Set([...(Array.isArray(options.fixedExoticHashes)?options.fixedExoticHashes:[]),options.fixedExoticHash].map(Number).filter(hash=>Number.isInteger(hash)&&hash>0));
  const hasFixedExotic=fixedExoticHashes.size>0;
  const groups=Array.from({length:5},()=>[]);
  for(const item of Array.isArray(items)?items:[]){
    const slot=Number(item?.slotIndex);
    if(!Number.isInteger(slot)||slot<0||slot>=groups.length)continue;
    const itemHash=Number(item?.itemHash??item?.hash);
    if(hasFixedExotic){
      if(item?.isExotic&&!fixedExoticHashes.has(itemHash))continue;
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
  return Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,Math.min(ARMOUR_STAT_CAP,Math.max(0,Math.round(finite(targets[key]))))]));
}

function normaliseStatPriorities(priorities={}){
  const used=new Set();
  return Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>{
    const rank=Math.round(finite(priorities[key]));
    if(rank<1||rank>ARMOUR_STAT_KEYS.length||used.has(rank))return [key,0];
    used.add(rank);return [key,rank];
  }));
}

function comparePriorityShortfalls(left=[],right=[]){
  for(let index=0;index<Math.max(left.length,right.length);index++){
    const delta=finite(left[index])-finite(right[index]);if(delta)return delta;
  }
  return 0;
}

function compareArmourScores(left={},right={}){
  return comparePriorityShortfalls(left.priorityShortfalls,right.priorityShortfalls)||finite(left.shortfall)-finite(right.shortfall)||finite(right.priorityTotal)-finite(left.priorityTotal)||finite(right.effectiveTotal)-finite(left.effectiveTotal)||finite(right.total)-finite(left.total);
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
    return [key,Math.min(ARMOUR_STAT_CAP,Math.max(0,...values))];
  }));
}

function scoreArmourStats(stats={},targets={},priorities={}){
  const requested=normaliseTargets(targets);
  const statPriorities=normaliseStatPriorities(priorities);
  const effectiveStats=Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,Math.min(ARMOUR_STAT_CAP,Math.max(0,finite(stats[key])))]));
  const active=ARMOUR_STAT_KEYS.filter(key=>requested[key]>0);
  const priorityOrder=active.filter(key=>statPriorities[key]>0).sort((left,right)=>statPriorities[left]-statPriorities[right]);
  let shortfall=0,overshoot=0,distance=0;
  for(const key of active){
    const delta=effectiveStats[key]-requested[key];
    if(delta<0)shortfall+=Math.abs(delta);else overshoot+=delta;
    distance+=Math.abs(delta);
  }
  const total=ARMOUR_STAT_KEYS.reduce((sum,key)=>sum+finite(stats[key]),0);
  const effectiveTotal=ARMOUR_STAT_KEYS.reduce((sum,key)=>sum+effectiveStats[key],0);
  const priorityTotal=active.reduce((sum,key)=>sum+effectiveStats[key],0);
  const shortfallByStat=Object.fromEntries(active.map(key=>[key,Math.max(0,requested[key]-effectiveStats[key])]));
  const priorityShortfalls=priorityOrder.map(key=>shortfallByStat[key]);
  return {active,statPriorities,priorityOrder,priorityShortfalls,shortfallByStat,effectiveStats,met:active.length>0&&shortfall===0,shortfall,overshoot,distance,total,effectiveTotal,priorityTotal};
}

function matchArmourBuilds(items=[],targets={},options={}){
  const requested=normaliseTargets(targets);
  if(!ARMOUR_STAT_KEYS.some(key=>requested[key]>0)&&options.autoMaximum!==true)return [];
  const returnAll=options.all===true;
  const limit=returnAll?Number.POSITIVE_INFINITY:Math.max(1,Math.min(20,Math.round(finite(options.limit)||5)));
  const beamLimit=returnAll?Number.POSITIVE_INFINITY:Math.max(100,Math.min(10000,Math.round(finite(options.beamLimit)||2500)));
  const groups=constrainedGroups(items,options);
  const requirements=setRequirements(options);
  const statPriorities=normaliseStatPriorities(options.statPriorities);
  const priorityOrder=ARMOUR_STAT_KEYS.filter(key=>requested[key]>0&&statPriorities[key]>0).sort((left,right)=>statPriorities[left]-statPriorities[right]);
  if(groups.some(group=>group.length===0))return [];
  if(!canCompleteSetRequirements(groups,0,requirements.map(()=>0),requirements))return [];
  const remaining=Array.from({length:groups.length+1},emptyVector);
  for(let slot=groups.length-1;slot>=0;slot--){
    const slotMaximum=Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,Math.max(0,...groups[slot].map(row=>row.stats[key]))]));
    remaining[slot]=addVectors(slotMaximum,remaining[slot+1]);
  }
  const partialRank=(state,nextSlot)=>{
    let optimisticShortfall=0,lockedOvershoot=0;
    const priorityShortfalls=[];
    for(const key of ARMOUR_STAT_KEYS.filter(name=>requested[name]>0)){
      const current=Math.min(ARMOUR_STAT_CAP,state.stats[key]),optimistic=Math.min(ARMOUR_STAT_CAP,state.stats[key]+remaining[nextSlot][key]);
      const shortfall=Math.max(0,requested[key]-optimistic);optimisticShortfall+=shortfall;
      if(priorityOrder.includes(key))priorityShortfalls[priorityOrder.indexOf(key)]=shortfall;
      lockedOvershoot+=Math.max(0,current-requested[key]);
    }
    const effectiveTotal=ARMOUR_STAT_KEYS.reduce((sum,key)=>sum+Math.min(ARMOUR_STAT_CAP,state.stats[key]),0);
    return {priorityShortfalls,optimisticShortfall,lockedOvershoot,effectiveTotal};
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
    next.sort((left,right)=>comparePriorityShortfalls(left.partialRank.priorityShortfalls,right.partialRank.priorityShortfalls)||left.partialRank.optimisticShortfall-right.partialRank.optimisticShortfall||left.partialRank.lockedOvershoot-right.partialRank.lockedOvershoot||right.partialRank.effectiveTotal-left.partialRank.effectiveTotal||left.signature.localeCompare(right.signature));
    beam=returnAll?next:next.slice(0,beamLimit);
  }
  return beam.map(candidate=>({...candidate,score:scoreArmourStats(candidate.stats,requested,statPriorities)}))
    .sort((left,right)=>compareArmourScores(left.score,right.score)||left.signature.localeCompare(right.signature))
    .slice(0,limit);
}

function candidateSignature(items=[]){
  return `|${items.map(item=>String(item?.itemInstanceId||item?.itemHash||item?.hash||'')).join('|')}`;
}

function compareArmourCandidates(left={},right={}){
  return comparePriorityShortfalls(left.score?.priorityShortfalls,right.score?.priorityShortfalls)||finite(left.score?.shortfall)-finite(right.score?.shortfall)||finite(right.secondaryRank)-finite(left.secondaryRank)||compareArmourScores(left.score,right.score)||String(left.signature||'').localeCompare(String(right.signature||''));
}

function matchTopArmourBuilds(items=[],targets={},options={}){
  const requested=normaliseTargets(targets);
  if(!ARMOUR_STAT_KEYS.some(key=>requested[key]>0)&&options.autoMaximum!==true)return [];
  const limit=Math.max(1,Math.min(250,Math.round(finite(options.limit)||50)));
  const groups=constrainedGroups(items,options);
  const requirements=setRequirements(options);
  const statPriorities=normaliseStatPriorities(options.statPriorities);
  const secondaryScore=typeof options.secondaryScore==='function'?options.secondaryScore:()=>0;
  const completionMemo=new Map();
  if(groups.some(group=>group.length===0)||!canCompleteSetRequirements(groups,0,requirements.map(()=>0),requirements,completionMemo))return [];
  const activeIndexes=ARMOUR_STAT_KEYS.map((key,index)=>requested[key]>0?index:-1).filter(index=>index>=0);
  const priorityIndexes=activeIndexes.filter(index=>statPriorities[ARMOUR_STAT_KEYS[index]]>0).sort((left,right)=>statPriorities[ARMOUR_STAT_KEYS[left]]-statPriorities[ARMOUR_STAT_KEYS[right]]);
  const requestedValues=ARMOUR_STAT_KEYS.map(key=>requested[key]);
  const numericGroups=groups.map(rows=>rows.map(row=>({item:row.item,values:ARMOUR_STAT_KEYS.map(key=>finite(row.stats[key])),requirementIndex:requirements.findIndex(requirement=>requirement.hash===row.setHash)})));
  const selected=Array(numericGroups.length);
  const totals=ARMOUR_STAT_KEYS.map(()=>0);
  const counts=requirements.map(()=>0);
  const heap=[];
  let combinationsEvaluated=0;

  const worse=(left,right)=>compareArmourCandidates(left,right)>0;
  const siftUp=start=>{
    let index=start;
    while(index>0){
      const parent=Math.floor((index-1)/2);
      if(!worse(heap[index],heap[parent]))break;
      [heap[index],heap[parent]]=[heap[parent],heap[index]];index=parent;
    }
  };
  const siftDown=start=>{
    let index=start;
    while(true){
      const left=index*2+1,right=left+1;
      if(left>=heap.length)break;
      let worst=left;if(right<heap.length&&worse(heap[right],heap[left]))worst=right;
      if(!worse(heap[worst],heap[index]))break;
      [heap[index],heap[worst]]=[heap[worst],heap[index]];index=worst;
    }
  };
  const retain=candidate=>{
    if(heap.length<limit){heap.push(candidate);siftUp(heap.length-1);return;}
    if(compareArmourCandidates(candidate,heap[0])>=0)return;
    heap[0]=candidate;siftDown(0);
  };
  const signature=()=>candidateSignature(selected);
  const compareCurrentTo=(candidate,currentSecondary)=>{
    for(let rank=0;rank<priorityIndexes.length;rank++){
      const index=priorityIndexes[rank],effective=Math.min(ARMOUR_STAT_CAP,Math.max(0,totals[index]));
      const delta=Math.max(0,requestedValues[index]-effective)-finite(candidate.score?.priorityShortfalls?.[rank]);
      if(delta)return delta;
    }
    let shortfall=0,priorityTotal=0,effectiveTotal=0,total=0;
    for(let index=0;index<ARMOUR_STAT_KEYS.length;index++){
      const effective=Math.min(ARMOUR_STAT_CAP,Math.max(0,totals[index]));
      if(requestedValues[index]>0){shortfall+=Math.max(0,requestedValues[index]-effective);priorityTotal+=effective;}
      effectiveTotal+=effective;total+=totals[index];
    }
    let delta=shortfall-finite(candidate.score?.shortfall);if(delta)return delta;
    delta=finite(candidate.secondaryRank)-currentSecondary;if(delta)return delta;
    delta=finite(candidate.score?.priorityTotal)-priorityTotal;if(delta)return delta;
    delta=finite(candidate.score?.effectiveTotal)-effectiveTotal;if(delta)return delta;
    delta=finite(candidate.score?.total)-total;if(delta)return delta;
    return signature().localeCompare(String(candidate.signature||''));
  };
  const retainCurrent=exoticCount=>{
    const secondaryRank=finite(secondaryScore(selected));
    if(heap.length>=limit&&compareCurrentTo(heap[0],secondaryRank)>=0)return;
    const stats=Object.fromEntries(ARMOUR_STAT_KEYS.map((key,index)=>[key,totals[index]]));
    retain({items:selected.slice(),stats,exoticCount,setCounts:counts.slice(),secondaryRank,signature:signature(),score:scoreArmourStats(stats,requested,statPriorities)});
  };
  const visit=(slot,exoticCount)=>{
    if(slot>=numericGroups.length){
      if(!requirements.every((row,index)=>counts[index]>=row.count))return;
      combinationsEvaluated+=1;retainCurrent(exoticCount);return;
    }
    for(const row of numericGroups[slot]){
      const nextExoticCount=exoticCount+(row.item?.isExotic?1:0);if(nextExoticCount>1)continue;
      selected[slot]=row.item;
      for(let index=0;index<totals.length;index++)totals[index]+=row.values[index];
      if(row.requirementIndex>=0)counts[row.requirementIndex]+=1;
      if(!requirements.length||canCompleteSetRequirements(groups,slot+1,counts,requirements,completionMemo))visit(slot+1,nextExoticCount);
      if(row.requirementIndex>=0)counts[row.requirementIndex]-=1;
      for(let index=0;index<totals.length;index++)totals[index]-=row.values[index];
    }
  };

  visit(0,0);
  const results=heap.sort(compareArmourCandidates);
  Object.defineProperties(results,{
    combinationsEvaluated:{value:combinationsEvaluated,enumerable:false},
    combinationsReturned:{value:results.length,enumerable:false},
    completeScan:{value:true,enumerable:false}
  });
  return results;
}

export {ARMOUR_STAT_CAP,ARMOUR_STAT_KEYS,ARMOUR_STAT_LABELS,armourSetHash,armourStatVector,armourTargetMaximums,compareArmourCandidates,compareArmourScores,matchArmourBuilds,matchTopArmourBuilds,normaliseStatPriorities,normaliseTargets,scoreArmourStats,setRequirements,statKey};
