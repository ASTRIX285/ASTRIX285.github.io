/* ASTRIX PARADOX — observed build analytics.
 * Aggregates Paradox-owned build snapshots only. No third-party scraping.
 * Popularity is descriptive evidence, never a synergy claim.
 */

const ANALYTICS_VERSION='paradox-observed-build-analytics-v1';

const slug=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const itemId=item=>String((item?.bungieHash??item?.hash??item?.itemHash??item?.itemInstanceId??slug(item?.name))||'');
const itemName=item=>String(item?.name??item?.displayProperties?.name??item?.definition?.displayProperties?.name??'').trim();

function pairKey(a,b){
  const left=itemId(a); const right=itemId(b);
  if(!left||!right)return '';
  return [left,right].sort().join('+');
}

function increment(map,key,label=''){
  if(!key)return;
  const current=map.get(key)||{key,label,count:0};
  current.count+=1;
  if(!current.label&&label)current.label=label;
  map.set(key,current);
}

function toRanking(map,total){
  return [...map.values()]
    .map(row=>({...row,share:total>0?row.count/total:0}))
    .sort((a,b)=>b.count-a.count||String(a.label).localeCompare(String(b.label)));
}

function normalizeObservedBuild(build={},meta={}){
  const subclassBuild=build.subclassBuild||{};
  return {
    analyticsVersion:ANALYTICS_VERSION,
    observedAt:meta.observedAt||new Date().toISOString(),
    source:meta.source||build.source||'paradox-build-space',
    consentScope:meta.consentScope||'local-session',
    characterClass:String(build.characterClass||'').toLowerCase(),
    subclass:String(build.subclass||build.subclassName||'').toLowerCase(),
    super:{id:itemId(subclassBuild.super),name:itemName(subclassBuild.super)},
    abilities:(subclassBuild.abilities||[]).map(item=>({id:itemId(item),name:itemName(item)})).filter(item=>item.id),
    aspects:(subclassBuild.aspects||[]).map(item=>({id:itemId(item),name:itemName(item)})).filter(item=>item.id),
    fragments:(subclassBuild.fragments||[]).map(item=>({id:itemId(item),name:itemName(item)})).filter(item=>item.id),
    artifactPerks:(build.artifact?.activePerks||[]).map(item=>({id:itemId(item),name:itemName(item)})).filter(item=>item.id),
    weapons:(build.weapons||[]).map(item=>({id:itemId(item),name:itemName(item),isExotic:Boolean(item?.isExotic||String(item?.tier||'').toLowerCase()==='exotic')})).filter(item=>item.id),
    armour:(build.armour||[]).map(item=>({id:itemId(item),name:itemName(item),isExotic:Boolean(item?.isExotic||String(item?.tier||'').toLowerCase()==='exotic')})).filter(item=>item.id)
  };
}

function aggregateObservedBuilds(observations=[]){
  const rows=observations.filter(Boolean);
  const total=rows.length;
  const classes=new Map();
  const subclasses=new Map();
  const supers=new Map();
  const weapons=new Map();
  const exoticArmour=new Map();
  const aspects=new Map();
  const fragments=new Map();
  const artifactPerks=new Map();
  const weaponPairs=new Map();
  const aspectPairs=new Map();

  for(const row of rows){
    increment(classes,row.characterClass,row.characterClass);
    increment(subclasses,`${row.characterClass}:${row.subclass}`,row.subclass);
    increment(supers,row.super?.id,row.super?.name);
    row.weapons?.forEach(item=>increment(weapons,item.id,item.name));
    row.armour?.filter(item=>item.isExotic).forEach(item=>increment(exoticArmour,item.id,item.name));
    row.aspects?.forEach(item=>increment(aspects,item.id,item.name));
    row.fragments?.forEach(item=>increment(fragments,item.id,item.name));
    row.artifactPerks?.forEach(item=>increment(artifactPerks,item.id,item.name));

    for(let i=0;i<(row.weapons?.length||0);i++)for(let j=i+1;j<row.weapons.length;j++){
      const key=pairKey(row.weapons[i],row.weapons[j]);
      increment(weaponPairs,key,`${row.weapons[i].name} + ${row.weapons[j].name}`);
    }
    for(let i=0;i<(row.aspects?.length||0);i++)for(let j=i+1;j<row.aspects.length;j++){
      const key=pairKey(row.aspects[i],row.aspects[j]);
      increment(aspectPairs,key,`${row.aspects[i].name} + ${row.aspects[j].name}`);
    }
  }

  return {
    analyticsVersion:ANALYTICS_VERSION,
    observationCount:total,
    generatedAt:new Date().toISOString(),
    descriptiveOnly:true,
    note:'Observed usage is not proof of synergy or recommendation quality.',
    rankings:{
      classes:toRanking(classes,total),
      subclasses:toRanking(subclasses,total),
      supers:toRanking(supers,total),
      weapons:toRanking(weapons,total),
      exoticArmour:toRanking(exoticArmour,total),
      aspects:toRanking(aspects,total),
      fragments:toRanking(fragments,total),
      artifactPerks:toRanking(artifactPerks,total),
      weaponPairs:toRanking(weaponPairs,total),
      aspectPairs:toRanking(aspectPairs,total)
    }
  };
}

export {ANALYTICS_VERSION,normalizeObservedBuild,aggregateObservedBuilds};
