import {armourSetHash} from '../vault/vault-armour-matcher.mjs';

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const CLASS_TYPES=Object.freeze({titan:0,hunter:1,warlock:2});
const BUNGIE_ORIGIN='https://www.bungie.net';
const identityName=value=>String(value??'').normalize('NFKD').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');

function exoticIdentityKey(item={},fallbackHash=''){
  const slot=Number(item?.slotIndex);
  const name=identityName(item?.name);
  return `${Number.isInteger(slot)?slot:'x'}:${name||`hash${Number(fallbackHash)||0}`}`;
}

function fixedExoticHashes(fixedExotic={}){
  const values=Array.isArray(fixedExotic?.hashes)?fixedExotic.hashes:[fixedExotic?.hash,fixedExotic?.itemHash];
  return new Set(values.map(Number).filter(hash=>Number.isInteger(hash)&&hash>0));
}

function compatibleWithClass(item,className=''){
  const requested=String(className||'').trim().toLowerCase();
  return !requested||item?.characterClass==='any'||item?.characterClass===requested;
}

function ownedExoticGroups(items=[],className=''){
  const groups=new Map();
  for(const item of Array.isArray(items)?items:[]){
    if(!item?.isExotic||!compatibleWithClass(item,className))continue;
    const hash=Number(item?.itemHash??item?.hash);
    if(!Number.isInteger(hash)||hash<=0)continue;
    const key=exoticIdentityKey(item,hash);
    if(!groups.has(key))groups.set(key,{key,hash,itemHash:hash,hashes:new Set(),name:item.name||`Exotic ${hash}`,slotIndex:Number(item.slotIndex),slotKey:item.slotKey||'',slotLabel:item.slotLabel||'',icon:item.icon||'',description:item.description||'',characterClass:item.characterClass||'any',instances:[]});
    groups.get(key).hashes.add(hash);
    groups.get(key).instances.push(item);
  }
  return [...groups.values()].map(group=>{
    group.instances.sort((left,right)=>finite(right.totalStats)-finite(left.totalStats)||finite(right.power)-finite(left.power)||String(left.itemInstanceId||'').localeCompare(String(right.itemInstanceId||'')));
    group.representative=group.instances[0]||null;
    group.hash=Number(group.representative?.itemHash??group.hash);
    group.itemHash=group.hash;
    group.hashes=[...group.hashes].sort((left,right)=>left-right);
    return group;
  }).sort((left,right)=>left.slotIndex-right.slotIndex||left.name.localeCompare(right.name));
}

function exoticCatalogueGroups(items=[],definitions={},className='',armourBuckets=[]){
  const owned=ownedExoticGroups(items,className);
  const groups=new Map(owned.map(group=>[group.key,{...group,owned:true,definition:null,preview:group.representative}]));
  const classType=CLASS_TYPES[String(className||'').trim().toLowerCase()];
  const slots=new Map((Array.isArray(armourBuckets)?armourBuckets:[]).map((slot,index)=>[Number(slot?.hash),{...slot,index}]));
  if(Number.isInteger(classType)){
    for(const [key,definition] of Object.entries(definitions||{})){
      const hash=Number(definition?.hash??key);
      const slot=slots.get(Number(definition?.inventory?.bucketTypeHash));
      const display=definition?.displayProperties||{};
      if(!Number.isInteger(hash)||hash<=0||!slot)continue;
      if(Number(definition?.itemType)!==2||Number(definition?.inventory?.tierType)!==6||Number(definition?.classType)!==classType)continue;
      if(definition?.redacted===true||definition?.equippable===false||!String(display.name||'').trim()||!String(display.icon||'').trim())continue;
      const icon=new URL(display.icon,BUNGIE_ORIGIN).toString();
      const preview={itemHash:hash,hash,name:String(display.name).trim(),description:String(display.description||'').trim(),icon,slotIndex:slot.index,slotKey:slot.key,slotLabel:slot.label,tier:String(definition?.inventory?.tierTypeName||'Exotic'),isExotic:true,characterClass:String(className).toLowerCase(),verifiedDefinition:true,definition};
      const identityKey=exoticIdentityKey(preview,hash);
      const existing=groups.get(identityKey);
      if(existing){existing.hashes=[...new Set([...(existing.hashes||[]),hash])].sort((left,right)=>left-right);continue;}
      groups.set(identityKey,{key:identityKey,hash,itemHash:hash,hashes:[hash],name:preview.name,slotIndex:slot.index,slotKey:slot.key,slotLabel:slot.label,icon,description:preview.description,characterClass:preview.characterClass,instances:[],representative:null,preview,owned:false,definition});
    }
  }
  return [...groups.values()].sort((left,right)=>left.slotIndex-right.slotIndex||Number(right.owned)-Number(left.owned)||left.name.localeCompare(right.name));
}

function constrainedSlotChoices(items=[],fixedExotic={}){
  const fixedHashes=fixedExoticHashes(fixedExotic);
  const fixedSlot=Number(fixedExotic?.slotIndex);
  const choices=Array.from({length:5},()=>new Set());
  for(const item of Array.isArray(items)?items:[]){
    const slot=Number(item?.slotIndex);
    if(!Number.isInteger(slot)||slot<0||slot>=choices.length)continue;
    const hash=Number(item?.itemHash??item?.hash);
    if(slot===fixedSlot){
      if(item?.isExotic&&fixedHashes.has(hash))choices[slot].add(armourSetHash(item)||0);
      continue;
    }
    if(item?.isExotic)continue;
    choices[slot].add(armourSetHash(item)||0);
  }
  return choices;
}

function normaliseSelections(rows=[]){
  const unique=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const setHash=Number(row?.setHash??row?.hash);
    const count=Number(row?.count??row?.requiredSetCount);
    if(Number.isInteger(setHash)&&setHash>0&&(count===2||count===4))unique.set(setHash,{setHash,count});
  }
  return [...unique.values()];
}

function setSelectionFeasible(items=[],fixedExotic={},selections=[]){
  const requirements=normaliseSelections(selections);
  if(!fixedExoticHashes(fixedExotic).size)return false;
  if(requirements.some(row=>row.count===4)&&requirements.length>1)return false;
  if(requirements.filter(row=>row.count===2).length>2)return false;
  const choices=constrainedSlotChoices(items,fixedExotic);
  if(choices.some(row=>row.size===0))return false;
  const memo=new Map();
  const visit=(slot,counts)=>{
    if(slot>=choices.length)return requirements.every((row,index)=>counts[index]>=row.count);
    const signature=`${slot}:${counts.join(',')}`;
    if(memo.has(signature))return memo.get(signature);
    for(const setHash of choices[slot]){
      const next=counts.slice();
      const index=requirements.findIndex(row=>row.setHash===setHash);
      if(index>=0)next[index]=Math.min(requirements[index].count,next[index]+1);
      if(visit(slot+1,next)){memo.set(signature,true);return true;}
    }
    memo.set(signature,false);
    return false;
  };
  return visit(0,requirements.map(()=>0));
}

function setBonusOptions(items=[],fixedExotic={},selections=[]){
  const selected=normaliseSelections(selections);
  const fixedSlot=Number(fixedExotic?.slotIndex);
  const fixedHashes=fixedExoticHashes(fixedExotic);
  const definitions=new Map();
  for(const item of Array.isArray(items)?items:[]){
    if(item?.isExotic&&!fixedHashes.has(Number(item?.itemHash??item?.hash)))continue;
    if(!item?.isExotic&&Number(item?.slotIndex)===fixedSlot)continue;
    const set=item?.setBonus||item?.armourSemantics?.set;
    const hash=Number(set?.hash);
    if(!Number.isInteger(hash)||hash<=0||set?.unresolved||!set?.identity)continue;
    if(!definitions.has(hash))definitions.set(hash,{hash,name:set.identity.name||`Armour set ${hash}`,description:set.identity.description||'',icon:set.identity.icon||'',twoPiece:set.twoPiece||null,fourPiece:set.fourPiece||null,slots:new Set()});
    definitions.get(hash).slots.add(Number(item.slotIndex));
  }
  const activeFour=selected.find(row=>row.count===4)||null;
  const activeTwos=selected.filter(row=>row.count===2);
  return [...definitions.values()].map(row=>{
    const choiceState=count=>{
      const checked=selected.some(selection=>selection.setHash===row.hash&&selection.count===count);
      const effect=count===2?row.twoPiece:row.fourPiece;
      let feasible=Boolean(effect)&&setSelectionFeasible(items,fixedExotic,[...selected.filter(selection=>selection.setHash!==row.hash),{setHash:row.hash,count}]);
      if(activeFour)feasible=checked;
      else if(activeTwos.length){
        if(count===4)feasible=false;
        else if(!checked&&activeTwos.length>=2)feasible=false;
      }
      return {checked,disabled:!checked&&!feasible,feasible,effect};
    };
    return {...row,usableSlots:row.slots.size,two:choiceState(2),four:choiceState(4)};
  }).sort((left,right)=>left.name.localeCompare(right.name));
}

function toggleSetSelection(items=[],fixedExotic={},selections=[],choice={},checked=false){
  const setHash=Number(choice?.setHash??choice?.hash);
  const count=Number(choice?.count);
  let next=normaliseSelections(selections).filter(row=>row.setHash!==setHash);
  if(!checked)return next;
  if(count===4)next=[{setHash,count:4}];
  else if(count===2){
    next=next.filter(row=>row.count===2).slice(0,1);
    next.push({setHash,count:2});
  }
  return setSelectionFeasible(items,fixedExotic,next)?next:normaliseSelections(selections);
}

export {compatibleWithClass,exoticCatalogueGroups,exoticIdentityKey,normaliseSelections,ownedExoticGroups,setBonusOptions,setSelectionFeasible,toggleSetSelection};
