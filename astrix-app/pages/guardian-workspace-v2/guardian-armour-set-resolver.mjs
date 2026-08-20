const absoluteIcon=path=>path?new URL(path,"https://www.bungie.net").toString():"";

function setHashFromItem(item){
  const value=item?.definition?.equipableItemSetHash??item?.definition?.equippingBlock?.equipableItemSetHash;
  const hash=Number(value);
  return Number.isInteger(hash)&&hash>0?hash:null;
}

function perkRow(payload,row){
  const hash=Number(row?.sandboxPerkHash);
  const definition=payload?.sandboxPerks?.[String(hash)]||null;
  return {
    hash,
    requiredSetCount:Number(row?.requiredSetCount)||0,
    name:definition?.displayProperties?.name||`Set perk ${hash}`,
    description:definition?.displayProperties?.description||"",
    icon:absoluteIcon(definition?.displayProperties?.icon),
    definition,
    active:false
  };
}

function resolveArmourSet(payload,item,equippedArmour=[]){
  const hash=setHashFromItem(item);
  if(!hash)return null;
  const definition=payload?.equipableItemSets?.[String(hash)]||null;
  if(!definition)return {hash,unresolved:true,identity:null,effects:[],twoPiece:null,fourPiece:null,equippedCount:0};
  const equippedCount=(equippedArmour||[]).filter(row=>setHashFromItem(row)===hash).length;
  const effects=(definition.setPerks||[]).map(row=>perkRow(payload,row)).map(row=>({...row,active:equippedCount>=row.requiredSetCount}));
  return {
    hash,
    unresolved:false,
    identity:{
      hash,
      name:definition?.displayProperties?.name||`Armour set ${hash}`,
      description:definition?.displayProperties?.description||"",
      icon:absoluteIcon(definition?.displayProperties?.icon),
      definition
    },
    equippedCount,
    effects,
    twoPiece:effects.find(row=>row.requiredSetCount===2)||null,
    fourPiece:effects.find(row=>row.requiredSetCount===4)||null
  };
}

export {setHashFromItem,resolveArmourSet};
