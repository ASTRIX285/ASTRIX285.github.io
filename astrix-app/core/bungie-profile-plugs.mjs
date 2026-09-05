// Character-scoped plug sets never confer availability on another character.
const ownersByProfile=new WeakMap();
export function characterPlugSetsForItem(profile,item){
  if(!profile||!item?.itemInstanceId)return [];
  let owners=ownersByProfile.get(profile);
  if(!owners){
    owners=new Map();
    for(const component of [profile.characterInventories,profile.characterEquipment])for(const [characterId,row] of Object.entries(component?.data||{}))for(const entry of row.items||[])if(entry.itemInstanceId)owners.set(String(entry.itemInstanceId),characterId);
    ownersByProfile.set(profile,owners);
  }
  const characterId=owners.get(String(item.itemInstanceId));
  const sets=characterId?profile.characterPlugSets?.data?.[characterId]?.plugs:null;
  return sets?[sets]:[];
}
