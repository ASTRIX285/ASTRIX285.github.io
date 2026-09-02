import {AUTH_ORIGIN,getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs';
import {guardianManifest} from '../guardian-workspace-v2/guardian-manifest-service.mjs';
import {readCachedBungieProfile} from '../guardian-workspace-v2/guardian-session-cache.mjs';
import {initLocationSelector} from '../../shared/astrix-location-selector.mjs';
import {initJourneyLocationMaps,publishJourneyDestinationData,publishJourneyRegionChestProgress} from './journey-location-maps.mjs?v=20260901-destination-data-panels';

const resolving=document.getElementById('journeyResolving');
const signedOut=document.getElementById('journeySignedOut');
const dashboard=document.getElementById('journeyDashboard');
const status=document.getElementById('journeyAuthStatus');
const favouriteCharacter=document.getElementById('journeyFavouriteCharacter');
const vaultCard=document.getElementById('journeyVault');
const milestonesCard=document.getElementById('journeyMilestones');
const heroCards=document.getElementById('guardianCharacterCards');
const feedStatus=document.getElementById('journeyFeedStatus');
const trendEmpty=document.getElementById('journeyTrendEmpty');
const guardianClass=document.getElementById('journeyGuardianClass');
const guardianSubclass=document.getElementById('journeyGuardianSubclass');
const journeyLevel=document.getElementById('journeyLevel');
const verifiedGuardian=document.getElementById('journeyVerifiedGuardian');
const guardianCrest=document.getElementById('journeyGuardianCrest');
const guardianCrestEmpty=document.getElementById('journeyGuardianCrestEmpty');
const totalPlaytime=document.getElementById('journeyTotalPlaytime');
const recentActivityCard=document.getElementById('journeyRecentActivity');
const titleSealCard=document.getElementById('journeyTitleSeal');
const titleProgressCard=document.getElementById('journeyTitleProgress');
const triumphStatsCard=document.getElementById('journeyTriumphStats');
const metricActivities=document.getElementById('journeyMetricActivities');
const metricCompletion=document.getElementById('journeyMetricCompletion');
const metricPve=document.getElementById('journeyMetricPve');
const metricPvp=document.getElementById('journeyMetricPvp');
const trendChart=document.getElementById('journeyTrendChart');
const focusHeading=document.getElementById('journeyFocusHeading');
const focusStatus=document.getElementById('journeyFocusStatus');
const locationSelector=document.getElementById('journeyLocationSelector');
const destinationDetail=document.getElementById('journeyLocationDetail');
const titlesOpen=document.getElementById('journeyTitlesOpen');
const badgesOpen=document.getElementById('journeyBadgesOpen');
const triumphsOpen=document.getElementById('journeyTriumphsOpen');
const guardianRankOpen=document.getElementById('journeyGuardianRankOpen');
const recordsOpen=document.getElementById('journeyRecordsOpen');
const recordsPanel=document.getElementById('journeyRecordsPanel');
const recordsBack=document.getElementById('journeyRecordsBack');
const recordsStatus=document.getElementById('journeyRecordsStatus');
const titlesList=document.getElementById('journeyTitlesList');
const badgesList=document.getElementById('journeyBadgesList');
const titleDetailHero=document.getElementById('journeyTitleDetailHero');
const titleRequirementsHeading=document.getElementById('journeyTitleRequirementsHeading');
const titleRequirementsList=document.getElementById('journeyTitleRequirementsList');
const triumphCategoriesList=document.getElementById('journeyTriumphCategoriesList');
const triumphDetailHero=document.getElementById('journeyTriumphDetailHero');
const triumphSubcategories=document.getElementById('journeyTriumphSubcategories');
const triumphDetailList=document.getElementById('journeyTriumphDetailList');
const guardianRankHero=document.getElementById('journeyGuardianRankHero');
const guardianRankStrip=document.getElementById('journeyGuardianRankStrip');
const guardianRankObjectives=document.getElementById('journeyGuardianRankObjectives');
const recordsSections=document.getElementById('journeyRecordsSections');
const recordsDetailGroup=document.getElementById('journeyRecordsDetailGroup');
const recordsDetailHero=document.getElementById('journeyRecordsDetailHero');
const recordsTypes=document.getElementById('journeyRecordsTypes');
const recordsDetailHeading=document.getElementById('journeyRecordsDetailHeading');
const recordsSubcategories=document.getElementById('journeyRecordsSubcategories');
const recordsDetailList=document.getElementById('journeyRecordsDetailList');
const CLASS_NAMES=['TITAN','HUNTER','WARLOCK'];
const MILESTONES_PENDING='No verified milestone or achievement source is connected.';
const RECENT_ACTIVITY_PENDING='Recent activity data is not connected.';
const BUNGIE_ORIGIN='https://www.bungie.net';
const numberFormatter=new Intl.NumberFormat('en-GB');
const activityDateFormatter=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'});
const manifestReady=guardianManifest.ready();
const PVP_MODES=new Set([5,10,12,15,19,25,31,32,37,38,39,41,42,43,44,45,48,49,50,51,52,53,54,55,56,57,59,60,61,62,65,67,68,69,70,71,72,73,74,80,81,84,88,89,90,91,92]);
const GAMBIT_MODES=new Set([63,75]);
let activeView='overview';
let timeFilter='all';
let selectedCharacterId='';
let selectedClassName='';
let verifiedProfile=null;
let journeySession=null;
let recentActivityRequest=0;
let profileIdentityRequest=0;
let historicalStatsRequest=0;
let currentFormRequest=0;
let titleTriumphRequest=0;
let triumphSectionRequest=0;
let recordsCategoryRequest=0;
let guardianRankRequest=0;
let guardianRankObjectiveRequest=0;
let destinationProgressRequest=0;
let activeRecordView='';
let selectedTitle=null;
let selectedTitleKind='titles';
let selectedTriumphCategory=null;
let selectedRecordSection=null;

function waitForHeroCards(){
  if(!heroCards||!heroCards.querySelector('.guardian-character-cards__status.is-pending'))return Promise.resolve();
  return new Promise(resolve=>document.addEventListener('astrix:hero-cards-render-complete',resolve,{once:true}));
}

function waitForJourneyAtmosphere(){
  const key=globalThis.AstrixDestinations?.current();
  const src=globalThis.ASTRIX_LOCATION_VISUALS?.[key]?.image;
  if(!src)return Promise.resolve();
  return new Promise(resolve=>{
    const image=new Image();
    let settled=false;
    const finish=async()=>{if(settled)return;settled=true;try{if(image.decode)await image.decode();}catch{}resolve();};
    image.addEventListener('load',finish,{once:true});
    image.addEventListener('error',resolve,{once:true});
    image.src=src;
    if(image.complete)finish();
  });
}

const finiteNumber=value=>{
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
};

function bindFavouriteCharacter(payload){
  const characters=Object.values(payload?.profile?.characters?.data||{}).map(character=>({
    className:CLASS_NAMES[Number(character?.classType)]||'',
    minutesPlayedTotal:finiteNumber(character?.minutesPlayedTotal),
    power:finiteNumber(character?.light)
  })).filter(character=>character.className&&character.minutesPlayedTotal!==null);
  if(!characters.length)return false;
  const highestMinutes=Math.max(...characters.map(character=>character.minutesPlayedTotal));
  const favourites=characters.filter(character=>character.minutesPlayedTotal===highestMinutes);
  const label=favourites.map(character=>character.className).join(' / ');
  const powers=[...new Set(favourites.map(character=>character.power).filter(Number.isFinite))];
  favouriteCharacter.textContent=`${label} · ${numberFormatter.format(highestMinutes)} MINUTES PLAYED${powers.length===1?` · POWER ${numberFormatter.format(powers[0])}`:''}`;
  return true;
}

const VAULT_BUCKET=138197802, POSTMASTER_BUCKET=215593132;
const SUBCLASS_BUCKET=3284755031;
function bindVault(payload){
  if(!vaultCard)return;
  const vaultItems=payload?.profile?.profileInventory?.data?.items;
  if(!Array.isArray(vaultItems))return;
  const vaultCount=vaultItems.filter(i=>i?.bucketHash===VAULT_BUCKET).length;
  let postmasterMax=0;
  for(const char of Object.values(payload?.profile?.characterInventories?.data||{})){
    const pm=(char?.items||[]).filter(i=>i?.bucketHash===POSTMASTER_BUCKET).length;
    if(pm>postmasterMax)postmasterMax=pm;
  }
  const warn=postmasterMax>=18?` · POSTMASTER ${postmasterMax}/21`:'';
  vaultCard.textContent=`${numberFormatter.format(vaultCount)} ITEMS IN VAULT${warn}`;
}
function bindMilestones(payload){
  if(!milestonesCard)return;
  milestonesCard.textContent=MILESTONES_PENDING;
  const prog=payload?.profile?.characterProgressions?.data;
  if(!prog)return;
  const hashes=new Set();
  const characters=selectedCharacterId&&prog[selectedCharacterId]?[prog[selectedCharacterId]]:Object.values(prog);
  for(const char of characters)for(const h of Object.keys(char?.milestones||{}))hashes.add(h);
  if(!hashes.size)return;
  milestonesCard.textContent=`${hashes.size} MILESTONES AVAILABLE THIS RESET`;
}

function formatPlaytime(minutes){
  if(!Number.isFinite(minutes))return '—';
  const total=Math.max(0,Math.round(minutes));
  const hours=Math.floor(total/60);
  return `${numberFormatter.format(hours)}h ${total%60}m`;
}

function bindActiveGuardian(payload){
  guardianClass.textContent='Guardian unavailable';
  guardianSubclass.textContent='Subclass awaiting verified data';
  verifiedGuardian.hidden=true;
  guardianCrest.hidden=true;
  guardianCrest.removeAttribute('src');
  guardianCrestEmpty.hidden=false;
  totalPlaytime.textContent='—';

  const characters=Object.values(payload?.profile?.characters?.data||{});
  const selected=characters.find(character=>String(character?.characterId||'')===selectedCharacterId)
    ||[...characters].sort((left,right)=>String(right?.dateLastPlayed||'').localeCompare(String(left?.dateLastPlayed||'')))[0];
  if(!selected)return;

  guardianClass.textContent=CLASS_NAMES[Number(selected.classType)]||'Guardian';
  verifiedGuardian.hidden=false;
  totalPlaytime.textContent=formatPlaytime(finiteNumber(selected.minutesPlayedTotal));
  if(selected.emblemPath){
    guardianCrest.src=new URL(selected.emblemPath,BUNGIE_ORIGIN).toString();
    guardianCrest.hidden=false;
    guardianCrestEmpty.hidden=true;
  }
  const equipped=payload?.profile?.characterEquipment?.data?.[String(selected.characterId||'')]?.items||[];
  const subclassItem=equipped.find(item=>item?.bucketHash===SUBCLASS_BUCKET);
  const subclassName=subclassItem&&payload?.definitions?.[String(subclassItem.itemHash)]?.displayProperties?.name;
  if(subclassName)guardianSubclass.textContent=String(subclassName).toUpperCase();
}

function bindGuardianRank(payload){
  if(!journeyLevel)return;
  const rank=finiteNumber(payload?.profile?.profile?.data?.currentGuardianRank);
  if(rank===null||rank<1){journeyLevel.textContent='—';return;}
  journeyLevel.innerHTML='';
  const img=document.createElement('img');
  img.className='journey-rank-badge';
  img.width=26;img.height=26;
  img.alt=`Guardian Rank ${rank}`;
  img.src=`../../../img/guardian-ranks/rank-${rank}.png`;
  img.onerror=()=>{journeyLevel.textContent=`RANK ${rank}`;};
  journeyLevel.appendChild(img);
}

function resetRecentActivity(){
  if(!recentActivityCard)return null;
  recentActivityCard.querySelector('[data-journey-recent-list]')?.remove();
  const fallback=recentActivityCard.querySelector('.apx-empty-state');
  if(fallback){fallback.hidden=false;fallback.textContent=RECENT_ACTIVITY_PENDING;}
  return fallback;
}

async function resolveActivityName(activity){
  const details=activity?.activityDetails||{};
  const hash=finiteNumber(details.referenceId??details.directorActivityHash);
  if(hash===null)return 'ACTIVITY NAME UNAVAILABLE';
  try{
    await manifestReady;
    const definition=await guardianManifest.getAsync('DestinyActivityDefinition',hash);
    return String(definition?.displayProperties?.name||'').trim()||'ACTIVITY NAME UNAVAILABLE';
  }catch{return 'ACTIVITY NAME UNAVAILABLE';}
}

async function resolveManifestDefinition(type,hash){
  if(hash===null||hash===undefined)return null;
  try{
    await manifestReady;
    return await guardianManifest.getAsync(type,hash);
  }catch{return null;}
}

function titleNameFor(recordDefinition,character,fallback){
  const titlesByGenderHash=recordDefinition?.titleInfo?.titlesByGenderHash||{};
  const titlesByGender=recordDefinition?.titleInfo?.titlesByGender||{};
  return String(titlesByGenderHash[String(character?.genderHash||'')]
    ||titlesByGender[character?.genderType]
    ||Object.values(titlesByGenderHash).find(Boolean)
    ||Object.values(titlesByGender).find(Boolean)
    ||fallback||'').trim();
}

function bungieIconUrl(path){
  if(typeof path!=='string'||!path)return '';
  try{
    const url=new URL(path,BUNGIE_ORIGIN);
    return url.origin===BUNGIE_ORIGIN?url.toString():'';
  }catch{return '';}
}

function bungiePresentationIcon(definition){
  return bungieIconUrl(definition?.displayProperties?.icon||definition?.originalIcon||definition?.rootViewIcon);
}

function titleRecordFor(payload,characterId,hash){
  return payload?.profile?.characterRecords?.data?.[characterId]?.records?.[String(hash)]
    ||payload?.profile?.profileRecords?.data?.records?.[String(hash)];
}

function titleRequirementRow(payload,characterId,entry,definition,objectiveDefinitions){
  const hash=finiteNumber(entry?.recordHash);
  const component=hash===null?null:titleRecordFor(payload,characterId,hash);
  const state=finiteNumber(component?.state);
  if(!definition||state!==null&&(state&16)===16)return null;
  const objectives=(Array.isArray(component?.objectives)?component.objectives:[]).filter(objective=>objective?.visible!==false).map(objective=>{
    const objectiveDefinition=objectiveDefinitions[String(objective?.objectiveHash)];
    return {hash:finiteNumber(objective?.objectiveHash),name:String(objectiveDefinition?.progressDescription||objectiveDefinition?.displayProperties?.name||'OBJECTIVE PROGRESS').trim(),completed:finiteNumber(objective?.progress),total:finiteNumber(objective?.completionValue),complete:objective?.complete===true};
  }).filter(objective=>objective.completed!==null&&objective.total!==null&&objective.total>0);
  const complete=state!==null?(state&4)!==4:objectives.length>0&&objectives.every(objective=>objective.complete);
  return {hash,name:String(definition?.displayProperties?.name||'').trim(),icon:bungiePresentationIcon(definition),description:String(state!==null&&(state&8)===8?definition?.stateInfo?.obscuredDescription||'':definition?.displayProperties?.description||''),complete,objectives};
}

async function presentationRecordCategories(entries,nodes,characterId,recordKind){
  const sections=[];
  const seen=new Set();
  let pending=(entries||[]).map(entry=>({entry,path:[]}));
  while(pending.length){
    const level=pending;
    pending=[];
    const definitions=await guardianManifest.getMany('DestinyPresentationNodeDefinition',level.map(item=>item.entry.presentationNodeHash));
    level.sort((left,right)=>Number(left.entry?.nodeDisplayPriority||0)-Number(right.entry?.nodeDisplayPriority||0)).forEach(item=>{
      const hash=String(item.entry?.presentationNodeHash||'');
      if(!hash||seen.has(hash))return;
      seen.add(hash);
      const definition=definitions[hash];
      const name=String(definition?.displayProperties?.name||'').trim();
      if(!definition||!name)return;
      const node=nodes?.[hash];
      const state=finiteNumber(node?.state);
      if(state!==null&&(state&1)===1)return;
      const path=[...item.path,name];
      const recordEntries=(definition?.children?.records||[]).slice().sort((left,right)=>Number(left?.nodeDisplayPriority||0)-Number(right?.nodeDisplayPriority||0));
      if(recordEntries.length)sections.push({key:hash,name:path.join(' · '),icon:bungiePresentationIcon(definition),completed:finiteNumber(node?.progressValue),total:finiteNumber(node?.completionValue),recordEntries,items:null,characterId,recordKind});
      pending.push(...(definition?.children?.presentationNodes||[]).map(entry=>({entry,path})));
    });
  }
  return sections;
}

async function presentationLeafCategories(rootHash,nodes,childKey){
  const hash=finiteNumber(rootHash);
  if(hash===null)return null;
  const rootDefinition=await guardianManifest.getAsync('DestinyPresentationNodeDefinition',hash);
  if(!rootDefinition)return null;
  const sections=[];
  const seen=new Set();
  let pending=[{entry:{presentationNodeHash:hash,nodeDisplayPriority:0},path:[],root:true}];
  while(pending.length){
    const level=pending;
    pending=[];
    const definitions=await guardianManifest.getMany('DestinyPresentationNodeDefinition',level.map(item=>item.entry.presentationNodeHash));
    level.sort((left,right)=>Number(left.entry?.nodeDisplayPriority||0)-Number(right.entry?.nodeDisplayPriority||0)).forEach(item=>{
      const nodeHash=String(item.entry?.presentationNodeHash||'');
      if(!nodeHash||seen.has(nodeHash))return;
      seen.add(nodeHash);
      const definition=definitions[nodeHash];
      const name=String(definition?.displayProperties?.name||'').trim();
      if(!definition||!name)return;
      const node=nodes?.[nodeHash];
      const state=finiteNumber(node?.state);
      if(state!==null&&(state&1)===1)return;
      const path=item.root?[]:[...item.path,name];
      const entries=(definition?.children?.[childKey]||[]).slice().sort((left,right)=>Number(left?.nodeDisplayPriority||0)-Number(right?.nodeDisplayPriority||0));
      if(entries.length)sections.push({key:nodeHash,name:path.join(' · ')||name,path,icon:bungiePresentationIcon(definition),completed:finiteNumber(node?.progressValue),total:finiteNumber(node?.completionValue),entries});
      pending.push(...(definition?.children?.presentationNodes||[]).map(entry=>({entry,path,root:false})));
    });
  }
  return {
    root:{hash:String(hash),name:String(rootDefinition?.displayProperties?.name||'').trim(),icon:bungiePresentationIcon(rootDefinition),node:nodes?.[String(hash)]},
    sections
  };
}

const DESTINATION_NAME_ALIASES=Object.freeze({
  'pale-heart':['Pale Heart','The Pale Heart'],
  'dreaming-city':['Dreaming City','The Dreaming City'],
  neomuna:['Neomuna'],europa:['Europa'],'throne-world':['Throne World',"Savathûn's Throne World","Savathun's Throne World"],
  nessus:['Nessus'],edz:['EDZ','European Dead Zone'],moon:['Moon','The Moon'],cosmodrome:['Cosmodrome']
});
const destinationNameKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function destinationNameMatches(key,value){
  const names=DESTINATION_NAME_ALIASES[key]||[globalThis.AstrixDestinations?.labelOf(key)||key];
  return names.some(name=>destinationNameKey(name)===destinationNameKey(value));
}

function journeyCharacterFor(payload){
  const characters=payload?.profile?.characters?.data||{};
  return characters[selectedCharacterId]||Object.values(characters).sort((left,right)=>String(right?.dateLastPlayed||'').localeCompare(String(left?.dateLastPlayed||'')))[0]||null;
}

function destinationRecordItem(row){
  return {name:row.name,icon:row.icon,description:row.description,completed:row.complete,objectives:(row.objectives||[]).map(objective=>({name:objective.name,current:objective.completed,total:objective.total,completed:objective.complete}))};
}

function destinationCategoryItem(section,label){
  const complete=section.completed!==null&&section.total!==null&&section.total>0&&section.completed>=section.total;
  return {name:section.name,icon:section.icon,description:label,current:section.completed,total:section.total,completed:complete};
}

async function destinationRecordSections(payload,key,characterId){
  const nodes=payload?.profile?.profilePresentationNodes?.data?.nodes||{};
  const presentationDefinitions=await guardianManifest.getMany('DestinyPresentationNodeDefinition',Object.keys(nodes));
  const resolved=Object.entries(nodes).map(([hash,node])=>({hash,node,definition:presentationDefinitions[hash]})).filter(item=>item.definition);
  const definitionByHash=Object.fromEntries(resolved.map(item=>[String(item.hash),item.definition]));
  const recordsRootHash=finiteNumber(payload?.profile?.profileRecords?.data?.recordCategoriesRootNodeHash);
  const recordsRoot=resolved.find(item=>String(item.hash)===String(recordsRootHash))||resolved.find(item=>!(item.definition?.parentNodeHashes||[]).length&&(item.definition?.children?.presentationNodes||[]).length>2&&(item.definition?.children?.presentationNodes||[]).some(entry=>{const definition=definitionByHash[String(entry.presentationNodeHash)];return definition?.displayProperties?.name===item.definition?.displayProperties?.name&&(definition?.children?.presentationNodes||[]).length;}));
  const currentEntry=(recordsRoot?.definition?.children?.presentationNodes||[]).find(entry=>definitionByHash[String(entry.presentationNodeHash)]?.displayProperties?.name===recordsRoot?.definition?.displayProperties?.name);
  const currentDefinition=definitionByHash[String(currentEntry?.presentationNodeHash||'')];
  const destinationEntry=(currentDefinition?.children?.presentationNodes||[]).find(entry=>destinationNameMatches(key,definitionByHash[String(entry.presentationNodeHash)]?.displayProperties?.name));
  const destinationDefinition=definitionByHash[String(destinationEntry?.presentationNodeHash||'')];
  const destinationNode=nodes[String(destinationEntry?.presentationNodeHash||'')];
  const destinationState=finiteNumber(destinationNode?.state);
  if(!destinationDefinition||destinationState!==null&&(destinationState&1)===1)return {triumphs:[],records:[],endgame:[]};
  const sections=await presentationRecordCategories(destinationDefinition?.children?.presentationNodes||[],nodes,characterId,'destination');
  const directEntries=(destinationDefinition?.children?.records||[]).slice().sort((left,right)=>Number(left?.nodeDisplayPriority||0)-Number(right?.nodeDisplayPriority||0));
  if(directEntries.length)sections.unshift({key:String(destinationEntry.presentationNodeHash),name:String(destinationDefinition?.displayProperties?.name||''),icon:bungiePresentationIcon(destinationDefinition),completed:finiteNumber(destinationNode?.progressValue),total:finiteNumber(destinationNode?.completionValue),recordEntries:directEntries,characterId,recordKind:'destination'});
  const recordEntries=sections.flatMap(section=>section.recordEntries);
  const recordDefinitions=await guardianManifest.getMany('DestinyRecordDefinition',recordEntries.map(entry=>entry.recordHash));
  const objectiveDefinitions=await guardianManifest.getMany('DestinyObjectiveDefinition',Object.values(recordDefinitions).flatMap(definition=>definition?.objectiveHashes||[]));
  const recordsBySection=sections.map(section=>({section,records:section.recordEntries.map(entry=>{
    const definition=recordDefinitions[String(entry.recordHash)];
    const row=titleRequirementRow(payload,characterId,entry,definition,objectiveDefinitions);
    return row?{entry,definition,row,component:titleRecordFor(payload,characterId,entry.recordHash)}:null;
  }).filter(Boolean)}));
  const triumphs=[];
  const records=[];
  recordsBySection.forEach(({section,records:sectionRecords})=>{
    const triumphRows=sectionRecords.filter(item=>!String(item.definition?.recordTypeName||'').trim()||destinationNameKey(item.definition.recordTypeName)==='triumphs');
    const recordRows=sectionRecords.filter(item=>String(item.definition?.recordTypeName||'').trim()&&destinationNameKey(item.definition.recordTypeName)!=='triumphs');
    if(triumphRows.length)triumphs.push(destinationCategoryItem(section,'TRIUMPH SUBCATEGORY'),...triumphRows.map(item=>destinationRecordItem(item.row)));
    if(recordRows.length)records.push(destinationCategoryItem(section,'RECORD CATEGORY'),...recordRows.map(item=>destinationRecordItem(item.row)));
  });
  const activityHashes=[...new Set(recordsBySection.flatMap(({records})=>records.flatMap(item=>(item.component?.objectives||[]).map(objective=>finiteNumber(objective?.activityHash)).filter(hash=>hash!==null))))];
  const activityDefinitions=await guardianManifest.getMany('DestinyActivityDefinition',activityHashes);
  const destinationDefinitions=await guardianManifest.getMany('DestinyDestinationDefinition',Object.values(activityDefinitions).map(definition=>definition?.destinationHash));
  const groups=new Map();
  recordsBySection.flatMap(({records})=>records).forEach(item=>{
    (item.component?.objectives||[]).filter(objective=>objective?.visible!==false).forEach(objective=>{
      const activityHash=finiteNumber(objective?.activityHash);
      const activity=activityDefinitions[String(activityHash)];
      const modes=activity?.activityModeTypes||[];
      const type=modes.includes(4)?'RAID':modes.includes(82)?'DUNGEON':'';
      const destination=destinationDefinitions[String(activity?.destinationHash||'')];
      const name=String(activity?.displayProperties?.name||'').trim();
      if(!type||!name||!destinationNameMatches(key,destination?.displayProperties?.name))return;
      const groupKey=`${type}:${name}`;
      if(!groups.has(groupKey))groups.set(groupKey,{type,name,icon:bungiePresentationIcon(activity),records:new Map()});
      const group=groups.get(groupKey);
      if(!group.records.has(item.row.hash))group.records.set(item.row.hash,{item,objectiveHashes:new Set()});
      group.records.get(item.row.hash).objectiveHashes.add(finiteNumber(objective?.objectiveHash));
    });
  });
  const endgame=[];
  [...groups.values()].sort((left,right)=>left.type.localeCompare(right.type)||left.name.localeCompare(right.name)).forEach(group=>{
    const groupRecords=[...group.records.values()];
    endgame.push({name:`${group.type} · ${group.name}`,icon:group.icon,description:'ACTIVITY',current:groupRecords.filter(({item})=>item.row.complete).length,total:groupRecords.length,completed:groupRecords.length>0&&groupRecords.every(({item})=>item.row.complete)});
    groupRecords.forEach(({item,objectiveHashes})=>endgame.push(destinationRecordItem({...item.row,objectives:item.row.objectives.filter(objective=>objectiveHashes.has(objective.hash))})));
  });
  return {triumphs,records,endgame};
}

async function destinationQuestRows(payload,key,characterId){
  const progression=payload?.profile?.characterProgressions?.data?.[characterId]||{};
  const statuses=(progression.quests||[]).map(status=>({status,questHash:finiteNumber(status?.questHash),stepHash:finiteNumber(status?.stepHash),objectives:status?.stepObjectives||[]}));
  Object.entries(progression.uninstancedItemObjectives||{}).forEach(([stepHash,objectives])=>statuses.push({status:{},questHash:null,stepHash:finiteNumber(stepHash),objectives:Array.isArray(objectives)?objectives:[]}));
  const itemDefinitions=await guardianManifest.getMany('DestinyInventoryItemDefinition',statuses.flatMap(item=>[item.questHash,item.stepHash]));
  const questHashes=statuses.map(item=>item.questHash??finiteNumber(itemDefinitions[String(item.stepHash)]?.objectives?.questlineItemHash)).filter(hash=>hash!==null);
  Object.assign(itemDefinitions,await guardianManifest.getMany('DestinyInventoryItemDefinition',questHashes));
  const objectiveDefinitions=await guardianManifest.getMany('DestinyObjectiveDefinition',statuses.flatMap(item=>item.objectives.map(objective=>objective?.objectiveHash)));
  const activityDefinitions=await guardianManifest.getMany('DestinyActivityDefinition',statuses.flatMap(item=>item.objectives.map(objective=>objective?.activityHash)));
  const destinationDefinitions=await guardianManifest.getMany('DestinyDestinationDefinition',[
    ...statuses.flatMap(item=>item.objectives.map(objective=>objective?.destinationHash)),
    ...Object.values(activityDefinitions).map(definition=>definition?.destinationHash)
  ]);
  const groups=new Map();
  statuses.forEach(item=>{
    const destinationObjectives=item.objectives.filter(objective=>objective?.visible!==false).filter(objective=>{
      const direct=destinationDefinitions[String(objective?.destinationHash||'')];
      const activity=activityDefinitions[String(objective?.activityHash||'')];
      const activityDestination=destinationDefinitions[String(activity?.destinationHash||'')];
      return destinationNameMatches(key,direct?.displayProperties?.name)||destinationNameMatches(key,activityDestination?.displayProperties?.name);
    });
    if(!destinationObjectives.length)return;
    const stepDefinition=itemDefinitions[String(item.stepHash)];
    const questHash=item.questHash??finiteNumber(stepDefinition?.objectives?.questlineItemHash);
    if(questHash===null)return;
    const questDefinition=itemDefinitions[String(questHash)]||stepDefinition;
    const groupName=String(questDefinition?.itemTypeAndTierDisplayName||stepDefinition?.itemTypeAndTierDisplayName||'QUESTS').trim();
    const objectives=destinationObjectives.map(objective=>({name:String(objectiveDefinitions[String(objective?.objectiveHash)]?.progressDescription||'OBJECTIVE PROGRESS').trim(),current:finiteNumber(objective?.progress),total:finiteNumber(objective?.completionValue),completed:objective?.complete===true})).filter(objective=>objective.current!==null&&objective.total!==null&&objective.total>0);
    const visibleObjectives=item.objectives.filter(objective=>objective?.visible!==false);
    const stepComplete=visibleObjectives.length>0&&visibleObjectives.every(objective=>objective?.complete===true);
    const questComplete=item.status?.completed===true;
    const quest={name:String(questDefinition?.displayProperties?.name||stepDefinition?.displayProperties?.name||'').trim(),icon:bungiePresentationIcon(questDefinition),description:String(questDefinition?.displayProperties?.description||''),completed:questComplete};
    const step={name:String(stepDefinition?.displayProperties?.name||quest.name).trim(),icon:bungiePresentationIcon(stepDefinition),description:String(stepDefinition?.displayProperties?.description||''),completed:stepComplete,objectives};
    if(!quest.name||!step.name)return;
    if(!groups.has(groupName))groups.set(groupName,[]);
    groups.get(groupName).push({quest,step});
  });
  const rows=[];
  for(const [groupName,quests] of groups){
    rows.push({name:groupName,description:'QUEST GROUP',current:quests.filter(item=>item.quest.completed).length,total:quests.length,completed:quests.length>0&&quests.every(item=>item.quest.completed)});
    quests.forEach(item=>rows.push(item.quest,item.step));
  }
  return rows;
}

async function bindRegionChestProgress(payload,key,characterId,requestId){
  const checklistStates={...(payload?.profile?.profileProgression?.data?.checklists||{}),...(payload?.profile?.characterProgressions?.data?.[characterId]?.checklists||{})};
  const checklistHashes=Object.keys(checklistStates);
  if(!checklistHashes.length)return;
  const checklistDefinitions=await guardianManifest.getMany('DestinyChecklistDefinition',checklistHashes);
  if(!Object.keys(checklistDefinitions).length)return;
  const entries=[];
  let regionChecklistFound=false;
  checklistHashes.forEach(hash=>{
    const definition=checklistDefinitions[hash];
    const label=`${definition?.displayProperties?.name||''} ${definition?.viewActionString||''}`;
    if(!/region chests?/i.test(label))return;
    regionChecklistFound=true;
    (definition?.entries||[]).forEach(entry=>entries.push({entry,state:checklistStates[hash]?.[String(entry?.hash)]}));
  });
  if(!regionChecklistFound)return;
  const activityDefinitions=await guardianManifest.getMany('DestinyActivityDefinition',entries.map(item=>item.entry?.activityHash));
  const locationDefinitions=await guardianManifest.getMany('DestinyLocationDefinition',entries.map(item=>item.entry?.locationHash));
  const destinationDefinitions=await guardianManifest.getMany('DestinyDestinationDefinition',[
    ...entries.map(item=>item.entry?.destinationHash),
    ...Object.values(activityDefinitions).map(definition=>definition?.destinationHash),
    ...Object.values(locationDefinitions).flatMap(definition=>(definition?.locationReleases||[]).map(release=>release?.destinationHash))
  ]);
  const matching=entries.filter(({entry})=>{
    const direct=destinationDefinitions[String(entry?.destinationHash||'')];
    const activity=activityDefinitions[String(entry?.activityHash||'')];
    const activityDestination=destinationDefinitions[String(activity?.destinationHash||'')];
    const location=locationDefinitions[String(entry?.locationHash||'')];
    return destinationNameMatches(key,direct?.displayProperties?.name)
      ||destinationNameMatches(key,activityDestination?.displayProperties?.name)
      ||(location?.locationReleases||[]).some(release=>destinationNameMatches(key,destinationDefinitions[String(release?.destinationHash||'')]?.displayProperties?.name));
  });
  const chests=matching.map(({entry,state})=>{
    const direct=destinationDefinitions[String(entry?.destinationHash||'')];
    const activity=activityDefinitions[String(entry?.activityHash||'')];
    const activityDestination=destinationDefinitions[String(activity?.destinationHash||'')];
    const locationDefinition=locationDefinitions[String(entry?.locationHash||'')];
    const locationDestination=(locationDefinition?.locationReleases||[]).map(release=>destinationDefinitions[String(release?.destinationHash||'')]).find(definition=>destinationNameMatches(key,definition?.displayProperties?.name));
    const destination=direct||activityDestination||locationDestination;
    const bubble=(destination?.bubbles||[]).find(item=>String(item?.hash)===String(entry?.bubbleHash));
    const location=String(bubble?.displayProperties?.name||locationDefinition?.displayProperties?.name||entry?.displayProperties?.description||activity?.displayProperties?.name||'').trim();
    return {name:String(entry?.displayProperties?.name||'').trim(),location,collected:typeof state==='boolean'?state:null};
  });
  if(requestId!==destinationProgressRequest||entries.length>0&&!matching.length||chests.some(chest=>!chest.name||!chest.location||chest.collected===null))return;
  publishJourneyRegionChestProgress({key,total:chests.length,discovered:chests.filter(chest=>chest.collected).length,chests});
}

async function bindDestinationProgress(payload,key=globalThis.AstrixDestinations?.current()){
  if(!payload||!key)return;
  const requestId=++destinationProgressRequest;
  await manifestReady;
  const character=journeyCharacterFor(payload);
  const characterId=String(character?.characterId||'');
  const regionChests=bindRegionChestProgress(payload,key,characterId,requestId);
  const [recordSections,quests]=await Promise.all([destinationRecordSections(payload,key,characterId),destinationQuestRows(payload,key,characterId)]);
  if(requestId!==destinationProgressRequest)return;
  publishJourneyDestinationData({key,sections:{triumphs:recordSections.triumphs,records:recordSections.records,quests,endgame:recordSections.endgame}});
  await regionChests;
}

const RECORD_SECTION_DEFINITIONS=[
  {key:'medals',name:'Medals',description:'Verified activity medals and earned counts.'},
  {key:'patterns-catalysts',name:'Patterns & Catalysts',description:'Weapon-pattern and catalyst objective progress.'},
  {key:'lore',name:'Lore',description:'Unlocked lore entries and collection progress.',optional:true},
  {key:'stat-trackers',name:'Stat Trackers',description:'Verified Guardian statistics with Mission Reports links.'}
];
const PATTERN_CATALYST_TYPE_DEFINITIONS=[
  {key:'primary',name:'Primary Weapon Patterns',shortName:'Primary',categories:['Auto Rifles','Bows','Hand Cannons','Pulse Rifles','Scout Rifles','Sidearms','Submachine Guns']},
  {key:'special',name:'Special Weapon Patterns',shortName:'Special',categories:['Fusion Rifles','Glaives','Grenade Launchers','Shotguns','Sniper Rifles','Trace Rifles']},
  {key:'heavy',name:'Heavy Weapon Patterns',shortName:'Heavy',categories:['Grenade Launchers','Linear Fusion Rifles','Machine Guns','Rocket Launchers','Swords']},
  {key:'catalysts',name:'Exotic Catalysts',shortName:'Catalysts',categories:['Kinetic Weapons','Energy Weapons','Power Weapons']}
];
const MISSION_REPORT_FILTERS=new Set(['view','category','mode','activity','activityHash','metricHash','trackerHash','period']);

function missionReportHref(filters){
  if(!filters||typeof filters!=='object')return '';
  const url=new URL('../mission-reports/',globalThis.location.href);
  Object.entries(filters).forEach(([key,value])=>{
    if(MISSION_REPORT_FILTERS.has(key)&&value!==null&&value!==undefined&&String(value).trim())url.searchParams.set(key,String(value));
  });
  return url.search?url.toString():'';
}

function makeJourneyRecordRow({hash,name,icon,description='',completed=null,total=null,unit='',gilded=false,complete=false,crafted=false,claimed=false,value=null,onSelect=null,missionReportFilters=null,objectives=[]}){
  const interactive=typeof onSelect==='function';
  const row=document.createElement(interactive?'button':'article');
  if(interactive){row.type='button';row.addEventListener('click',onSelect);}
  row.className=`journey-record-row${gilded?' is-gilded':''}${complete?' is-complete':''}${crafted?' is-crafted':''}${icon?'':' has-no-icon'}`;
  if(hash!==null&&hash!==undefined)row.dataset.presentationNodeHash=String(hash);
  if(icon){
    const image=document.createElement('img');
    image.className='journey-record-icon';
    image.src=icon;
    image.alt='';
    image.loading='lazy';
    row.appendChild(image);
  }
  const copy=document.createElement('div');
  copy.className='journey-record-copy';
  const title=document.createElement('strong');
  title.className='journey-record-title';
  title.textContent=`${name}${gilded?' · GILDED':crafted?' · CRAFTED':claimed?' · CLAIMED':''}`;
  if(complete||crafted){const check=document.createElement('span');check.className='journey-record-check';check.textContent='✓';title.appendChild(check);}
  copy.appendChild(title);
  if(description){const text=document.createElement('span');text.className='journey-record-description';text.textContent=description;copy.appendChild(text);}
  const verifiedProgress=completed!==null&&total!==null&&total>0;
  const hasValue=value!==null&&value!==undefined&&String(value)!=='';
  if(unit||verifiedProgress||hasValue){
    const progress=document.createElement('div');
    progress.className='journey-record-progress';
    const label=document.createElement('span');
    label.textContent=unit||'VERIFIED VALUE';
    const output=document.createElement('b');
    output.textContent=verifiedProgress?`${numberFormatter.format(completed)} / ${numberFormatter.format(total)}`:hasValue?(typeof value==='number'?numberFormatter.format(value):String(value)):'AWAITING VERIFIED COUNTS';
    progress.append(label,output);
    copy.appendChild(progress);
  }
  if(verifiedProgress){
    const bounded=Math.max(0,Math.min(total,completed));
    const track=document.createElement('div');
    track.className='journey-record-track';
    track.setAttribute('role','progressbar');
    track.setAttribute('aria-label',`${name} ${unit.toLowerCase()}`);
    track.setAttribute('aria-valuemin','0');
    track.setAttribute('aria-valuemax',String(total));
    track.setAttribute('aria-valuenow',String(bounded));
    const fill=document.createElement('i');
    fill.className='journey-record-fill';
    fill.style.width=`${bounded/total*100}%`;
    track.appendChild(fill);
    copy.appendChild(track);
  }
  objectives.forEach(objective=>{
    if(objective.completed===null||objective.total===null||objective.total<=0)return;
    const bounded=Math.max(0,Math.min(objective.total,objective.completed));
    const progress=document.createElement('div');
    progress.className='journey-record-progress';
    const label=document.createElement('span');
    label.textContent=objective.name;
    const output=document.createElement('b');
    output.textContent=`${numberFormatter.format(objective.completed)} / ${numberFormatter.format(objective.total)}`;
    progress.append(label,output);
    const track=document.createElement('div');
    track.className='journey-record-track';
    track.setAttribute('role','progressbar');
    track.setAttribute('aria-label',`${name} ${objective.name.toLowerCase()}`);
    track.setAttribute('aria-valuemin','0');
    track.setAttribute('aria-valuemax',String(objective.total));
    track.setAttribute('aria-valuenow',String(bounded));
    const fill=document.createElement('i');
    fill.className='journey-record-fill';
    fill.style.width=`${bounded/objective.total*100}%`;
    track.appendChild(fill);
    copy.append(progress,track);
  });
  const reportHref=interactive?'':missionReportHref(missionReportFilters);
  if(reportHref){
    const link=document.createElement('a');
    link.className='journey-record-link';
    link.href=reportHref;
    link.textContent='VIEW MISSION REPORTS';
    copy.appendChild(link);
  }
  row.appendChild(copy);
  return row;
}

function renderJourneyRecordList(list,rows,emptyText,onSelect=null){
  if(!list)return;
  list.replaceChildren();
  if(!rows.length){
    const empty=document.createElement('span');
    empty.className='apx-empty-state journey-records-empty';
    empty.textContent=emptyText;
    list.appendChild(empty);
    return;
  }
  const fragment=document.createDocumentFragment();
  rows.forEach(row=>fragment.appendChild(makeJourneyRecordRow({...row,onSelect:onSelect?()=>onSelect(row):null})));
  list.appendChild(fragment);
}

function renderDetailHero(host,{name,icon='',description='',completed=null,total=null,unit=''}){
  if(!host)return;
  host.replaceChildren();
  host.classList.toggle('has-no-icon',!icon);
  if(icon){const image=document.createElement('img');image.className='journey-record-detail-icon';image.src=icon;image.alt='';host.appendChild(image);}
  const copy=document.createElement('div');
  copy.className='journey-record-detail-copy';
  const heading=document.createElement('h4');
  heading.textContent=name;
  copy.appendChild(heading);
  if(description){const text=document.createElement('p');text.textContent=description;copy.appendChild(text);}
  const verified=completed!==null&&total!==null&&total>0;
  if(verified){
    const progress=document.createElement('div');
    progress.className='journey-record-progress';
    progress.innerHTML=`<span>${unit}</span><b>${numberFormatter.format(completed)} / ${numberFormatter.format(total)}</b>`;
    const track=document.createElement('div');
    track.className='journey-record-track';
    const fill=document.createElement('i');
    fill.className='journey-record-fill';
    fill.style.width=`${Math.max(0,Math.min(total,completed))/total*100}%`;
    track.appendChild(fill);
    copy.append(progress,track);
  }
  host.appendChild(copy);
}

function normalizedProgressItem(item={},defaultUnit='OBJECTIVES'){
  const objectiveProgress=item?.objectiveProgress&&typeof item.objectiveProgress==='object'?item.objectiveProgress:{};
  const explicitCompleted=typeof item.completed==='number'?item.completed:null;
  let completed=finiteNumber(item.completedCount??item.completedObjectives??item.patternProgress??item.catalystProgress??objectiveProgress.progress??item.progressValue??explicitCompleted);
  let total=finiteNumber(item.totalCount??item.totalObjectives??item.patternTotal??item.catalystTotal??objectiveProgress.completionValue??item.completionValue??item.total);
  const complete=item.complete===true||item.completed===true||item.patternUnlocked===true||item.catalystComplete===true||objectiveProgress.complete===true;
  return {
    hash:item.recordHash??item.presentationNodeHash??item.metricHash??item.trackerHash??item.itemHash??item.hash,
    name:String(item.name||'').trim(),
    icon:bungieIconUrl(item.iconPath),
    description:String(item.description||'').trim(),
    completed,
    total,
    unit:String(item.unit||defaultUnit).trim().toUpperCase(),
    complete,
    crafted:item.crafted===true,
    gilded:item.gilded===true,
    value:item.value??(completed!==null&&!(total!==null&&total>0)?completed:null),
    missionReportFilters:item.missionReportFilters&&typeof item.missionReportFilters==='object'?item.missionReportFilters:null
  };
}

function journeyRecordHookRows(payload,view){
  const source=view==='titles'?payload?.journeyRecordOverview?.titles:view==='badges'?payload?.journeyRecordOverview?.badges:payload?.journeyRecordOverview?.triumphCategories;
  if(!Array.isArray(source))return null;
  return source.map(item=>{
    if(view==='titles'||view==='badges'){
      const requirements=Array.isArray(item?.requirements)?item.requirements.map(row=>normalizedProgressItem(row,'OBJECTIVES')).filter(row=>row.name):[];
      const usesRequirements=item?.completedRequirements!==undefined||item?.totalRequirements!==undefined||requirements.length>0;
      const completed=finiteNumber(item?.completedRequirements??item?.completedActivities);
      const total=finiteNumber(item?.totalRequirements??item?.totalActivities);
      return {
        hash:item?.presentationNodeHash,
        name:String(view==='badges'?(item?.badgeName||item?.name||''):(item?.titleName||item?.name||'')).trim(),
        detailName:String(item?.collectionName||item?.name||item?.titleName||'').trim(),
        icon:bungieIconUrl(item?.iconPath),
        description:String(item?.description||'').trim(),
        completed:completed??(requirements.length?requirements.filter(row=>row.complete).length:null),
        total:total??(requirements.length?requirements.length:null),
        unit:usesRequirements?'TITLE REQUIREMENTS':'ACTIVITIES',
        gilded:item?.gilded===true,
        requirements
      };
    }
    const subcategories=Array.isArray(item?.subcategories)?item.subcategories.map(section=>({
      hash:section?.presentationNodeHash??section?.hash,
      name:String(section?.name||'').trim(),
      icon:bungieIconUrl(section?.iconPath),
      completed:finiteNumber(section?.completedTriumphs),
      total:finiteNumber(section?.totalTriumphs),
      items:(section?.triumphs||section?.records||section?.items||[]).map(row=>normalizedProgressItem(row,'TRIUMPHS')).filter(row=>row.name)
    })).filter(section=>section.name):[];
    const direct=(item?.triumphs||item?.records||[]).map(row=>normalizedProgressItem(row,'TRIUMPHS')).filter(row=>row.name);
    return {
      hash:item?.presentationNodeHash,
      name:String(item?.name||'').trim(),
      icon:bungieIconUrl(item?.iconPath),
      description:String(item?.description||'').trim(),
      completed:finiteNumber(item?.completedTriumphs),
      total:finiteNumber(item?.totalTriumphs),
      unit:'TRIUMPHS',
      subcategories:subcategories.length?subcategories:(direct.length?[{name:String(item?.name||'Triumphs'),items:direct}]:[])
    };
  }).filter(item=>item.hash!==null&&item.hash!==undefined&&item.name).sort((left,right)=>left.name.localeCompare(right.name));
}

function renderSubmenu(host,sections,onSelect){
  if(!host)return;
  host.replaceChildren();
  const fragment=document.createDocumentFragment();
  sections.forEach((section,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=section.name;
    button.setAttribute('aria-current',String(index===0));
    button.addEventListener('click',()=>{
      host.querySelectorAll('button').forEach(item=>item.setAttribute('aria-current',String(item===button)));
      onSelect(section);
    });
    fragment.appendChild(button);
  });
  host.appendChild(fragment);
  if(sections[0])onSelect(sections[0]);
}

function renderRecordTypes(host,types,onSelect){
  if(!host)return;
  host.replaceChildren();
  const fragment=document.createDocumentFragment();
  types.forEach((type,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.setAttribute('role','tab');
    button.setAttribute('aria-label',type.name);
    button.setAttribute('aria-current',String(index===0));
    button.setAttribute('aria-selected',String(index===0));
    if(type.icon){const image=document.createElement('img');image.src=type.icon;image.alt='';button.appendChild(image);}
    const label=document.createElement('span');
    label.textContent=type.shortName||type.name;
    button.appendChild(label);
    const counts=[];
    if(type.completed!==null&&type.total!==null&&type.total>0)counts.push(`${numberFormatter.format(type.completed)} / ${numberFormatter.format(type.total)}`);
    if(type.craftedCount!==null)counts.push(`${numberFormatter.format(type.craftedCount)} CRAFTED`);
    if(counts.length){const status=document.createElement('small');status.textContent=counts.join(' · ');button.appendChild(status);}
    button.addEventListener('click',()=>{
      host.querySelectorAll('button').forEach(item=>{const selected=item===button;item.setAttribute('aria-current',String(selected));item.setAttribute('aria-selected',String(selected));});
      onSelect(type);
    });
    fragment.appendChild(button);
  });
  host.appendChild(fragment);
  if(types[0])onSelect(types[0]);
}

function recordRootView(view){
  if(view==='title-detail')return selectedTitleKind;
  if(view==='triumph-detail')return 'triumphs';
  if(view==='records-detail')return 'records';
  return view;
}

function activateRecordView(view){
  activeRecordView=view;
  recordsPanel?.querySelectorAll('[data-journey-record-view]').forEach(group=>group.hidden=group.dataset.journeyRecordView!==view);
  const root=recordRootView(view);
  const headings={titles:'Titles',badges:'Badges',triumphs:'Triumphs','guardian-rank':'Guardian Rank',records:'Records'};
  if(focusHeading)focusHeading.textContent=headings[root]||'Guardian Records';
  if(focusStatus)focusStatus.textContent='VERIFIED BUNGIE RECORDS';
  if(recordsBack)recordsBack.textContent=view==='title-detail'?selectedTitleKind==='badges'?'Back to Badges':'Back to Titles':view==='triumph-detail'?'Back to Triumph Categories':view==='records-detail'?'Back to Records':'Back to Destination';
  setRecordSelectorState(root);
}

function showTitleDetail(title,kind='titles'){
  selectedTitle=title;
  selectedTitleKind=kind;
  activateRecordView('title-detail');
  const isBadge=kind==='badges';
  const label=isBadge?'BADGE':'TITLE';
  if(titleRequirementsHeading)titleRequirementsHeading.textContent=isBadge?'Badge Requirements':'Title Requirements';
  const detailName=title.detailName||title.name;
  const description=[title.description,title.name!==detailName?`${label} · ${title.name}`:''].filter(Boolean).join(' · ');
  renderDetailHero(titleDetailHero,{name:detailName,icon:title.icon,description,completed:title.completed,total:title.total,unit:`${label} PROGRESS`});
  if(Array.isArray(title.requirements)){renderJourneyRecordList(titleRequirementsList,title.requirements,`Verified requirements for this ${label.toLowerCase()} are not yet connected.`);return;}
  renderJourneyRecordList(titleRequirementsList,[],`Loading verified ${label.toLowerCase()} requirements.`);
  void (async()=>{
    const entries=title.requirementEntries||[];
    const recordDefinitions=await guardianManifest.getMany('DestinyRecordDefinition',entries.map(entry=>entry.recordHash));
    const objectiveHashes=Object.values(recordDefinitions).flatMap(definition=>definition?.objectiveHashes||[]);
    const objectiveDefinitions=await guardianManifest.getMany('DestinyObjectiveDefinition',objectiveHashes);
    const requirements=entries.map(entry=>titleRequirementRow(verifiedProfile,title.characterId,entry,recordDefinitions[String(entry.recordHash)],objectiveDefinitions)).filter(requirement=>requirement?.name);
    title.requirements=requirements;
    if(selectedTitle!==title)return;
    title.completed=requirements.filter(requirement=>requirement.complete).length;
    title.total=requirements.length;
    renderDetailHero(titleDetailHero,{name:detailName,icon:title.icon,description,completed:title.completed,total:title.total,unit:`${label} REQUIREMENTS`});
    renderJourneyRecordList(titleRequirementsList,requirements,`No verified requirements were returned for this ${label.toLowerCase()}.`);
  })();
}

function showBadgeDetail(badge){showTitleDetail(badge,'badges');}

function showTriumphDetail(category){
  selectedTriumphCategory=category;
  activateRecordView('triumph-detail');
  renderDetailHero(triumphDetailHero,{name:category.name,icon:category.icon,description:category.description,completed:category.completed,total:category.total,unit:'TRIUMPHS'});
  const renderSections=()=>{
    renderSubmenu(triumphSubcategories,category.subcategories||[],section=>{
      const requestId=++triumphSectionRequest;
      if(Array.isArray(section.items)){renderJourneyRecordList(triumphDetailList,section.items,'No verified Triumphs were returned for this subcategory.');return;}
      renderJourneyRecordList(triumphDetailList,[],'Loading verified Triumph records.');
      void (async()=>{
        const recordDefinitions=await guardianManifest.getMany('DestinyRecordDefinition',section.recordEntries.map(entry=>entry.recordHash));
        const objectiveDefinitions=await guardianManifest.getMany('DestinyObjectiveDefinition',Object.values(recordDefinitions).flatMap(definition=>definition?.objectiveHashes||[]));
        section.items=section.recordEntries.map(entry=>{
          const definition=recordDefinitions[String(entry.recordHash)];
          const row=titleRequirementRow(verifiedProfile,category.characterId,entry,definition,objectiveDefinitions);
          const state=finiteNumber(titleRecordFor(verifiedProfile,category.characterId,entry.recordHash)?.state);
          const score=finiteNumber(definition?.completionInfo?.ScoreValue);
          return row?{...row,unit:score===null?'':'TRIUMPH SCORE',value:score,claimed:state!==null&&(state&1)===1}:null;
        }).filter(item=>item?.name);
        if(selectedTriumphCategory===category&&requestId===triumphSectionRequest)renderJourneyRecordList(triumphDetailList,section.items,'No verified Triumphs were returned for this subcategory.');
      })();
    });
    if(!(category.subcategories||[]).length)renderJourneyRecordList(triumphDetailList,[],'No verified Triumph subcategories were returned.');
  };
  if(Array.isArray(category.subcategories)){renderSections();return;}
  triumphSubcategories?.replaceChildren();
  renderJourneyRecordList(triumphDetailList,[],'Loading verified Triumph subcategories.');
  void (async()=>{
    const sections=[];
    const seen=new Set();
    let pending=(category.nodeEntries||[]).map(entry=>({entry,path:[]}));
    while(pending.length){
      const level=pending;
      pending=[];
      const definitions=await guardianManifest.getMany('DestinyPresentationNodeDefinition',level.map(item=>item.entry.presentationNodeHash));
      level.sort((left,right)=>Number(left.entry?.nodeDisplayPriority||0)-Number(right.entry?.nodeDisplayPriority||0)).forEach(item=>{
        const hash=String(item.entry?.presentationNodeHash||'');
        if(!hash||seen.has(hash))return;
        seen.add(hash);
        const definition=definitions[hash];
        const name=String(definition?.displayProperties?.name||'').trim();
        if(!definition||!name)return;
        const path=[...item.path,name];
        const recordEntries=(definition?.children?.records||[]).slice().sort((left,right)=>Number(left?.nodeDisplayPriority||0)-Number(right?.nodeDisplayPriority||0));
        if(recordEntries.length){const node=category.nodes?.[hash];sections.push({hash,name:path.join(' · '),icon:bungiePresentationIcon(definition),completed:finiteNumber(node?.progressValue),total:finiteNumber(node?.completionValue),recordEntries,items:null});}
        pending.push(...(definition?.children?.presentationNodes||[]).map(entry=>({entry,path})));
      });
    }
    category.subcategories=sections;
    if(selectedTriumphCategory===category)renderSections();
  })();
}

async function bindTitleTriumphPanel(payload,view=recordRootView(activeRecordView)){
  const requestId=++titleTriumphRequest;
  const isTitleCollection=view==='titles'||view==='badges';
  const titleCollectionList=view==='badges'?badgesList:titlesList;
  const titleCollectionLabel=view==='badges'?'BADGES':'TITLES';
  const titleCollectionSelect=view==='badges'?showBadgeDetail:showTitleDetail;
  if(recordsStatus)recordsStatus.textContent='LOADING VERIFIED BUNGIE DEFINITIONS';
  const hookedRows=journeyRecordHookRows(payload,view);
  if(hookedRows){
    renderJourneyRecordList(isTitleCollection?titleCollectionList:triumphCategoriesList,hookedRows,isTitleCollection?`No verified Destiny ${titleCollectionLabel.toLowerCase()} were returned.`:'No verified Triumph category rows were returned.',isTitleCollection?titleCollectionSelect:showTriumphDetail);
    if(recordsStatus)recordsStatus.textContent=isTitleCollection?`${hookedRows.length} ${titleCollectionLabel}`:`${hookedRows.length} TRIUMPH CATEGORIES`;
    return;
  }
  const nodes=payload?.profile?.profilePresentationNodes?.data?.nodes;
  if(!nodes||typeof nodes!=='object'){
    if(view==='titles')renderJourneyRecordList(titlesList,[],'Title presentation nodes are not present in the verified profile response.');
    if(view==='badges')renderJourneyRecordList(badgesList,[],'Badge presentation nodes are not present in the verified profile response.');
    if(view==='triumphs')renderJourneyRecordList(triumphCategoriesList,[],'Triumph presentation nodes are not present in the verified profile response.');
    if(recordsStatus)recordsStatus.textContent='VERIFIED RECORD DATA UNAVAILABLE';
    return;
  }
  const characters=payload?.profile?.characters?.data||{};
  const character=characters[selectedCharacterId]||Object.values(characters).sort((left,right)=>String(right?.dateLastPlayed||'').localeCompare(String(left?.dateLastPlayed||'')))[0];
  const characterId=String(character?.characterId||'');
  await manifestReady;
  const presentationDefinitions=await guardianManifest.getMany('DestinyPresentationNodeDefinition',Object.keys(nodes));
  const resolved=Object.entries(nodes).map(([hash,node])=>({hash,node,definition:presentationDefinitions[hash]})).filter(item=>item.definition);
  if(requestId!==titleTriumphRequest)return;
  const titleCandidates=resolved.filter(item=>finiteNumber(item.definition?.completionRecordHash)!==null);
  if(isTitleCollection){
    const recordDefinitions=await guardianManifest.getMany('DestinyRecordDefinition',titleCandidates.map(item=>item.definition.completionRecordHash));
    const titles=titleCandidates.map(item=>{
      const completionRecordHash=finiteNumber(item.definition.completionRecordHash);
      const recordDefinition=recordDefinitions[String(completionRecordHash)];
      const hasTitle=recordDefinition?.titleInfo?.hasTitle===true;
      if(view==='titles'?!hasTitle:hasTitle)return null;
      const name=view==='badges'?String(item.definition?.displayProperties?.name||'').trim():titleNameFor(recordDefinition,character,item.definition?.displayProperties?.name);
      if(!name||!recordDefinition?.titleInfo)return null;
      const activityProgress=payload?.journeyTitleActivityProgress?.[String(item.hash)];
      const activityCompleted=finiteNumber(activityProgress?.completedActivities);
      const activityTotal=finiteNumber(activityProgress?.totalActivities);
      const hasActivityCounts=activityCompleted!==null&&activityTotal!==null&&activityTotal>0;
      const state=finiteNumber(titleRecordFor(payload,characterId,completionRecordHash)?.state);
      const requirementEntries=(item.definition?.children?.records||[]).slice().sort((left,right)=>Number(left?.nodeDisplayPriority||0)-Number(right?.nodeDisplayPriority||0));
      return {hash:item.hash,name,detailName:String(item.definition?.displayProperties?.name||name),icon:bungiePresentationIcon(item.definition),description:String(item.definition?.displayProperties?.description||''),completed:hasActivityCounts?activityCompleted:finiteNumber(item.node?.progressValue),total:hasActivityCounts?activityTotal:finiteNumber(item.node?.completionValue),unit:hasActivityCounts?'ACTIVITIES':view==='badges'?'BADGE REQUIREMENTS':'TITLE REQUIREMENTS',gilded:view==='titles'&&state!==null&&(state&128)===128,requirements:null,requirementEntries,characterId};
    }).filter(Boolean).sort((left,right)=>left.name.localeCompare(right.name));
    if(requestId!==titleTriumphRequest)return;
    renderJourneyRecordList(titleCollectionList,titles,`No Destiny ${titleCollectionLabel.toLowerCase()} presentation nodes were returned for this profile.`,titleCollectionSelect);
    if(recordsStatus)recordsStatus.textContent=`${titles.length} ${titleCollectionLabel}`;
    return;
  }
  const definitionByHash=Object.fromEntries(resolved.map(item=>[String(item.hash),item.definition]));
  const triumphRoot=resolved.find(item=>!(item.definition?.parentNodeHashes||[]).length&&(item.definition?.children?.presentationNodes||[]).length>2&&(item.definition?.children?.presentationNodes||[]).some(entry=>{const definition=definitionByHash[String(entry.presentationNodeHash)];return definition?.displayProperties?.name===item.definition?.displayProperties?.name&&(definition?.children?.presentationNodes||[]).length;}));
  const currentTriumphEntry=(triumphRoot?.definition?.children?.presentationNodes||[]).find(entry=>definitionByHash[String(entry.presentationNodeHash)]?.displayProperties?.name===triumphRoot?.definition?.displayProperties?.name);
  const currentTriumphDefinition=definitionByHash[String(currentTriumphEntry?.presentationNodeHash||'')];
  const categories=(currentTriumphDefinition?.children?.presentationNodes||[]).map(entry=>{
    const hash=String(entry.presentationNodeHash);
    const definition=definitionByHash[hash];
    const node=nodes[hash];
    return {hash,name:String(definition?.displayProperties?.name||'').trim(),icon:bungiePresentationIcon(definition),description:String(definition?.displayProperties?.description||''),completed:finiteNumber(node?.progressValue),total:finiteNumber(node?.completionValue),unit:'TRIUMPHS',subcategories:null,nodeEntries:definition?.children?.presentationNodes||[],nodes,characterId};
  }).filter(item=>item.name);
  if(requestId!==titleTriumphRequest)return;
  renderJourneyRecordList(triumphCategoriesList,categories,'No Triumph category presentation nodes were returned for this profile.',showTriumphDetail);
  if(recordsStatus)recordsStatus.textContent=`${categories.length} TRIUMPH CATEGORIES`;
}

function guardianRankRows(payload){
  const hook=payload?.journeyRecordOverview?.guardianRank||{};
  const profileRank=finiteNumber(payload?.profile?.profile?.data?.currentGuardianRank);
  const currentRank=finiteNumber(hook.currentRank)??profileRank;
  const supplied=Array.isArray(hook.ranks)?hook.ranks:[];
  const byRank=new Map(supplied.map(item=>[Number(item?.rank),item]));
  return {currentRank,currentRankName:String(hook.currentRankName||'').trim(),nextRank:finiteNumber(hook.nextRank),ranks:Array.from({length:11},(_,index)=>{
    const rank=index+1;
    const item=byRank.get(rank)||{};
    return {rank,name:String(item.name||`Rank ${rank}`).trim(),icon:bungieIconUrl(item.iconPath),description:String(item.description||'').trim(),completed:finiteNumber(item.completedObjectives),total:finiteNumber(item.totalObjectives),objectives:(item.objectives||[]).map(row=>normalizedProgressItem(row,'OBJECTIVES')).filter(row=>row.name)};
  })};
}

async function bindGuardianRankPanel(payload){
  const requestId=++guardianRankRequest;
  guardianRankObjectiveRequest+=1;
  let data=guardianRankRows(payload);
  if(!Array.isArray(payload?.journeyRecordOverview?.guardianRank?.ranks)){
    if(recordsStatus)recordsStatus.textContent='LOADING VERIFIED GUARDIAN RANKS';
    await manifestReady;
    const constants=await guardianManifest.getAsync('DestinyGuardianRankConstantsDefinition',1);
    const rankHashes=(constants?.guardianRankHashes||[]).slice(0,finiteNumber(constants?.rankCount)??11);
    const rankDefinitions=await guardianManifest.getMany('DestinyGuardianRankDefinition',rankHashes);
    const presentationDefinitions=await guardianManifest.getMany('DestinyPresentationNodeDefinition',rankHashes.map(hash=>rankDefinitions[String(hash)]?.presentationNodeHash));
    const nodes=payload?.profile?.profilePresentationNodes?.data?.nodes||{};
    const characters=payload?.profile?.characters?.data||{};
    const character=characters[selectedCharacterId]||Object.values(characters).sort((left,right)=>String(right?.dateLastPlayed||'').localeCompare(String(left?.dateLastPlayed||'')))[0];
    const characterId=String(character?.characterId||'');
    const currentRank=finiteNumber(payload?.profile?.profile?.data?.currentGuardianRank);
    const ranks=rankHashes.map((hash,index)=>{
      const definition=rankDefinitions[String(hash)];
      const rank=finiteNumber(definition?.rankNumber)??index+1;
      const presentationHash=String(definition?.presentationNodeHash||'');
      const presentation=presentationDefinitions[presentationHash];
      const node=nodes[presentationHash];
      return {rank,name:String(definition?.displayProperties?.name||`Rank ${rank}`).trim(),icon:bungiePresentationIcon(definition),description:String(definition?.displayProperties?.description||'').trim(),completed:finiteNumber(node?.progressValue),total:finiteNumber(node?.completionValue),objectives:null,nodeEntries:presentation?.children?.presentationNodes||[],characterId,nodes};
    });
    if(ranks.length)data={currentRank,currentRankName:ranks.find(item=>item.rank===currentRank)?.name||'',nextRank:currentRank===null?null:Math.min(ranks.length,currentRank+1),ranks};
  }
  if(requestId!==guardianRankRequest)return;
  const fallbackRank=data.currentRank===null?1:Math.min(11,Math.max(1,data.currentRank+1));
  const selected=data.ranks.find(item=>item.rank===(data.nextRank??fallbackRank))||data.ranks[0];
  guardianRankStrip?.replaceChildren();
  data.ranks.forEach(item=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=String(item.rank);
    button.setAttribute('aria-current',String(item===selected));
    button.addEventListener('click',()=>{
      guardianRankStrip.querySelectorAll('button').forEach(row=>row.setAttribute('aria-current',String(row===button)));
      const next=data.currentRank===null?null:data.ranks.find(rank=>rank.rank===data.currentRank+1);
      const description=data.currentRank===null?'Current Guardian Rank unavailable':`CURRENT RANK ${data.currentRank}${data.currentRankName?` · ${data.currentRankName}`:''}${next?` · NEXT RANK ${next.rank} · ${next.name}`:' · MAXIMUM RANK'}`;
      renderDetailHero(guardianRankHero,{name:item.name,icon:item.icon,description,completed:item.completed,total:item.total,unit:'RANK PROGRESS'});
      const objectiveRequest=++guardianRankObjectiveRequest;
      if(Array.isArray(item.objectives)){renderJourneyRecordList(guardianRankObjectives,item.objectives,'No verified objectives were returned for this Guardian Rank.');return;}
      renderJourneyRecordList(guardianRankObjectives,[],'Loading verified Guardian Rank objectives.');
      void (async()=>{
        const sections=await presentationRecordCategories(item.nodeEntries,item.nodes,item.characterId,'guardian-rank');
        const recordEntries=sections.flatMap(section=>section.recordEntries);
        const recordDefinitions=await guardianManifest.getMany('DestinyRecordDefinition',recordEntries.map(entry=>entry.recordHash));
        const objectiveDefinitions=await guardianManifest.getMany('DestinyObjectiveDefinition',Object.values(recordDefinitions).flatMap(definition=>definition?.objectiveHashes||[]));
        item.objectives=sections.flatMap(section=>{
          const category={hash:section.key,name:section.name,icon:section.icon,completed:section.completed,total:section.total,unit:'CATEGORY PROGRESS',complete:section.completed!==null&&section.total!==null&&section.total>0&&section.completed>=section.total};
          const objectives=section.recordEntries.map(entry=>titleRequirementRow(payload,item.characterId,entry,recordDefinitions[String(entry.recordHash)],objectiveDefinitions)).filter(row=>row?.name);
          return [category,...objectives];
        });
        if(objectiveRequest===guardianRankObjectiveRequest)renderJourneyRecordList(guardianRankObjectives,item.objectives,'No verified objectives were returned for this Guardian Rank.');
      })();
    });
    guardianRankStrip?.appendChild(button);
  });
  guardianRankStrip?.querySelector('button[aria-current="true"]')?.click();
  if(recordsStatus)recordsStatus.textContent=data.currentRank===null?'GUARDIAN RANK DATA UNAVAILABLE':`CURRENT GUARDIAN RANK ${data.currentRank}`;
}

function recordCategoryKey(value){return String(value||'').trim().toLowerCase().replaceAll('&','and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}

function patternsCatalystsTypes(source){
  const supplied=Array.isArray(source.types)?source.types:Array.isArray(source.categories)?source.categories:[];
  const byKey=new Map(supplied.map(type=>[recordCategoryKey(type?.key||type?.name),type]));
  return PATTERN_CATALYST_TYPE_DEFINITIONS.map(definition=>{
    const alternateKey=definition.key==='catalysts'?'exotic-catalysts':`${definition.key}-patterns`;
    const type=byKey.get(definition.key)||byKey.get(alternateKey)||byKey.get(recordCategoryKey(definition.name))||{};
    const suppliedCategories=Array.isArray(type.categories)?type.categories:Array.isArray(type.groups)?type.groups:[];
    const categoryByKey=new Map(suppliedCategories.map(category=>[recordCategoryKey(category?.key||category?.name),category]));
    const used=new Set();
    const categories=definition.categories.map(name=>{
      const key=recordCategoryKey(name);
      const category=categoryByKey.get(key)||{};
      used.add(key);
      return {key,name:String(category.name||name),items:(category.items||[]).map(item=>normalizedProgressItem(item,definition.key==='catalysts'?'CATALYST PROGRESS':'PATTERN PROGRESS')).filter(item=>item.name)};
    });
    suppliedCategories.forEach(category=>{
      const key=recordCategoryKey(category?.key||category?.name);
      if(!key||used.has(key)||!String(category?.name||'').trim())return;
      categories.push({key,name:String(category.name).trim(),items:(category.items||[]).map(item=>normalizedProgressItem(item,definition.key==='catalysts'?'CATALYST PROGRESS':'PATTERN PROGRESS')).filter(item=>item.name)});
    });
    return {key:definition.key,name:String(type.name||definition.name),shortName:String(type.shortName||definition.shortName),icon:bungieIconUrl(type.iconPath),completed:finiteNumber(type.completed??type.unlockedPatterns??type.completedCatalysts),total:finiteNumber(type.total??type.totalPatterns??type.totalCatalysts),craftedCount:finiteNumber(type.craftedCount),categories};
  });
}

function recordsFrameworkSections(payload){
  const supplied=payload?.journeyRecordOverview?.records?.sections;
  const byKey=new Map((Array.isArray(supplied)?supplied:[]).map(section=>[String(section?.key||''),section]));
  return RECORD_SECTION_DEFINITIONS.map(definition=>{
    const source=byKey.get(definition.key)||{};
    const completed=finiteNumber(source.completed);
    const total=finiteNumber(source.total);
    const sourceCategories=Array.isArray(source.categories)?source.categories:[];
    const hasVerifiedData=source.available===true||completed!==null||total!==null||sourceCategories.some(category=>[category?.allItems,category?.all?.items,category?.all,category?.items].some(items=>Array.isArray(items)&&items.length));
    if(definition.optional&&!hasVerifiedData)return null;
    let categories=definition.key==='patterns-catalysts'?[]:sourceCategories.map(category=>{
      const allItems=Array.isArray(category?.allItems)?category.allItems:Array.isArray(category?.all?.items)?category.all.items:Array.isArray(category?.all)?category.all:Array.isArray(category?.items)?category.items:[];
      const rows=(definition.key==='stat-trackers'?allItems:category?.items||[]).map(item=>{
        const row=normalizedProgressItem(item,definition.key==='stat-trackers'?'TRACKER VALUE':'PROGRESS');
        return row;
      }).filter(item=>item.name);
      return {key:String(category?.key||category?.name||''),name:String(category?.name||'').trim(),items:rows};
    }).filter(category=>category.name);
    return {key:definition.key,name:String(source.name||definition.name),description:String(source.description||definition.description),icon:bungieIconUrl(source.iconPath),completed,total,unit:completed!==null&&total!==null&&total>0?'RECORDS':'',categories,types:definition.key==='patterns-catalysts'?patternsCatalystsTypes(source):[]};
  }).filter(Boolean);
}

async function verifiedCraftablePatternTypes(payload,characterId){
  const components=payload?.profile?.characterCraftables?.data||{};
  let componentCharacterId=characterId;
  let component=components[componentCharacterId];
  if(!component){
    const fallback=Object.entries(components).find(([,item])=>finiteNumber(item?.craftingRootNodeHash)!==null);
    componentCharacterId=String(fallback?.[0]||'');
    component=fallback?.[1];
  }
  const rootHash=finiteNumber(component?.craftingRootNodeHash);
  const craftables=component?.craftables;
  if(rootHash===null||!craftables||typeof craftables!=='object')return null;
  const nodes={
    ...(payload?.profile?.profilePresentationNodes?.data?.nodes||{}),
    ...(payload?.profile?.characterPresentationNodes?.data?.[componentCharacterId]?.nodes||{})
  };
  const tree=await presentationLeafCategories(rootHash,nodes,'craftables');
  if(!tree)return null;
  const entries=tree.sections.flatMap(section=>section.entries);
  const definitions=await guardianManifest.getMany('DestinyInventoryItemDefinition',entries.map(entry=>entry.craftableItemHash));
  const typeByAmmo=new Map([[1,'primary'],[2,'special'],[3,'heavy']]);
  const types=new Map(PATTERN_CATALYST_TYPE_DEFINITIONS.filter(type=>type.key!=='catalysts').map(type=>[type.key,{key:type.key,icon:'',categories:new Map(),completed:0,total:0}]));
  tree.sections.forEach(section=>{
    const categoryName=String(section.path.at(-1)||section.name||'').trim();
    if(!categoryName)return;
    section.entries.forEach(entry=>{
      const hash=finiteNumber(entry?.craftableItemHash);
      if(hash===null)return;
      const state=craftables[String(hash)];
      const definition=definitions[String(hash)];
      if(!state||state.visible!==true||!definition||definition.redacted===true)return;
      const type=types.get(typeByAmmo.get(finiteNumber(definition?.equippingBlock?.ammoType)));
      const name=String(definition?.displayProperties?.name||'').trim();
      if(!type||!name)return;
      const failedRequirements=Array.isArray(state.failedRequirementIndexes)?state.failedRequirementIndexes:null;
      const unlocked=failedRequirements===null?null:failedRequirements.length===0;
      const categoryKey=recordCategoryKey(categoryName);
      if(!type.categories.has(categoryKey))type.categories.set(categoryKey,{key:categoryKey,name:categoryName,icon:section.icon,items:[]});
      type.categories.get(categoryKey).items.push({
        hash,
        name,
        icon:bungiePresentationIcon(definition),
        description:String(definition?.itemTypeDisplayName||definition?.displayProperties?.description||'').trim(),
        unit:'PATTERN STATUS',
        value:unlocked===true?'UNLOCKED':unlocked===false?'LOCKED':'VISIBLE',
        complete:unlocked===true,
        patternStateVerified:unlocked!==null
      });
      if(!type.icon)type.icon=section.icon;
      if(unlocked!==null){type.total+=1;if(unlocked)type.completed+=1;}
    });
  });
  return [...types.values()].map(type=>({...type,total:type.total||null,completed:type.total?type.completed:null,categories:[...type.categories.values()].map(category=>({...category,items:category.items.map(({patternStateVerified,...item})=>item)}))}));
}

function mergeVerifiedPatternTypes(section,verifiedTypes){
  if(!section||!Array.isArray(verifiedTypes))return;
  verifiedTypes.forEach(verified=>{
    const type=section.types?.find(item=>item.key===verified.key);
    if(!type)return;
    const categories=new Map((type.categories||[]).map(category=>[recordCategoryKey(category.key||category.name),category]));
    verified.categories.forEach(category=>{
      const key=recordCategoryKey(category.key||category.name);
      const existing=categories.get(key);
      if(existing){
        const rows=new Map((existing.items||[]).map(item=>[String(item.hash),item]));
        category.items.forEach(item=>rows.set(String(item.hash),item));
        existing.items=[...rows.values()];
      }else{
        type.categories.push(category);
        categories.set(key,category);
      }
    });
    if(verified.icon)type.icon=verified.icon;
    type.completed=verified.completed;
    type.total=verified.total;
  });
  const counted=(section.types||[]).filter(type=>type.completed!==null&&type.total!==null&&type.total>0);
  if(counted.length){section.completed=counted.reduce((total,type)=>total+type.completed,0);section.total=counted.reduce((total,type)=>total+type.total,0);}
}

async function verifiedStatTrackerSection(payload){
  const component=payload?.profile?.metrics?.data;
  const metrics=component?.metrics;
  const rootHash=finiteNumber(component?.metricsRootNodeHash);
  if(rootHash===null||!metrics||typeof metrics!=='object')return null;
  const nodes=payload?.profile?.profilePresentationNodes?.data?.nodes||{};
  const tree=await presentationLeafCategories(rootHash,nodes,'metrics');
  if(!tree)return null;
  const metricEntries=tree.sections.flatMap(section=>section.entries);
  const metricDefinitions=await guardianManifest.getMany('DestinyMetricDefinition',metricEntries.map(entry=>entry.metricHash));
  const objectiveDefinitions=await guardianManifest.getMany('DestinyObjectiveDefinition',Object.values(metricDefinitions).map(definition=>definition?.trackingObjectiveHash));
  const groups=new Map();
  tree.sections.forEach(section=>{
    const rows=section.entries.map(entry=>{
      const hash=finiteNumber(entry?.metricHash);
      if(hash===null)return null;
      const state=metrics[String(hash)];
      const definition=metricDefinitions[String(hash)];
      const progress=state?.objectiveProgress;
      const current=finiteNumber(progress?.progress);
      const total=finiteNumber(progress?.completionValue);
      const name=String(definition?.displayProperties?.name||'').trim();
      if(!state||state.invisible===true||!definition||definition.redacted===true||current===null||!name)return null;
      const objective=objectiveDefinitions[String(definition?.trackingObjectiveHash||'')];
      const hasThreshold=total!==null&&total>0;
      return {
        hash,
        name,
        icon:bungiePresentationIcon(definition),
        description:String(definition?.displayProperties?.description||objective?.progressDescription||'').trim(),
        completed:hasThreshold?current:null,
        total:hasThreshold?total:null,
        unit:hasThreshold?'TRACKER PROGRESS':'TRACKER VALUE',
        value:hasThreshold?null:current,
        complete:progress?.complete===true,
        gilded:false,
        missionReportFilters:{view:'stat-trackers',category:String(section.path[0]||section.name),metricHash:hash}
      };
    }).filter(Boolean);
    if(!rows.length)return;
    const groupName=String(section.path[0]||section.name).trim();
    const groupKey=recordCategoryKey(groupName);
    if(!groups.has(groupKey))groups.set(groupKey,{key:groupKey,name:groupName,all:new Map(),leaves:[]});
    const group=groups.get(groupKey);
    rows.forEach(row=>group.all.set(String(row.hash),row));
    group.leaves.push({key:section.key,name:section.name,items:rows});
  });
  const categories=[];
  groups.forEach(group=>{
    categories.push({key:`${group.key}-all`,name:`${group.name} · ALL`,items:[...group.all.values()]});
    if(group.leaves.length>1||group.leaves[0]?.name!==group.name)categories.push(...group.leaves);
  });
  if(!categories.length)return null;
  return {
    icon:tree.root.icon,
    completed:finiteNumber(tree.root.node?.progressValue),
    total:finiteNumber(tree.root.node?.completionValue),
    categories
  };
}

function showRecordsDetail(section){
  selectedRecordSection=section;
  activateRecordView('records-detail');
  renderDetailHero(recordsDetailHero,{name:section.name,icon:section.icon,description:section.description,completed:section.completed,total:section.total,unit:'SECTION PROGRESS'});
  const renderCategory=(category,emptyText)=>{
    const requestId=++recordsCategoryRequest;
    if(Array.isArray(category.items)){renderJourneyRecordList(recordsDetailList,category.items,emptyText);return;}
    renderJourneyRecordList(recordsDetailList,[],'Loading verified Bungie records.');
    void (async()=>{
      const recordDefinitions=await guardianManifest.getMany('DestinyRecordDefinition',category.recordEntries.map(entry=>entry.recordHash));
      const objectiveDefinitions=await guardianManifest.getMany('DestinyObjectiveDefinition',Object.values(recordDefinitions).flatMap(definition=>definition?.objectiveHashes||[]));
      category.items=category.recordEntries.map(entry=>{
        const definition=recordDefinitions[String(entry.recordHash)];
        const row=titleRequirementRow(verifiedProfile,category.characterId,entry,definition,objectiveDefinitions);
        const component=titleRecordFor(verifiedProfile,category.characterId,entry.recordHash);
        const earned=category.recordKind==='medals'?finiteNumber(component?.completedCount):null;
        return row?{...row,unit:earned===null?'':'EARNED',value:earned}:null;
      }).filter(item=>item?.name);
      if(selectedRecordSection===section&&requestId===recordsCategoryRequest)renderJourneyRecordList(recordsDetailList,category.items,emptyText);
    })();
  };
  const patternsCatalysts=section.key==='patterns-catalysts';
  recordsDetailGroup?.classList.toggle('is-patterns-catalysts',patternsCatalysts);
  if(recordsTypes)recordsTypes.hidden=!patternsCatalysts;
  if(patternsCatalysts){
    renderRecordTypes(recordsTypes,section.types||[],type=>{
      if(recordsDetailHeading)recordsDetailHeading.textContent=type.name;
      renderSubmenu(recordsSubcategories,type.categories||[],category=>renderCategory(category,type.key==='catalysts'?'No verified catalyst records were returned for this weapon group.':'Verified pattern progress for this weapon type is not yet connected.'));
    });
    return;
  }
  recordsTypes?.replaceChildren();
  if(recordsDetailHeading)recordsDetailHeading.textContent='Record Categories';
  renderSubmenu(recordsSubcategories,section.categories||[],category=>{
    renderCategory(category,section.key==='stat-trackers'?'Verified Stat Trackers for this category are not yet connected.':'No verified records were returned for this category.');
  });
  if(!(section.categories||[]).length)renderJourneyRecordList(recordsDetailList,[],'Verified Record categories are not yet connected.');
}

async function bindRecordsPanel(payload){
  let sections=recordsFrameworkSections(payload);
  const nodes=payload?.profile?.profilePresentationNodes?.data?.nodes;
  if(!Array.isArray(payload?.journeyRecordOverview?.records?.sections)&&nodes&&typeof nodes==='object'){
    if(recordsStatus)recordsStatus.textContent='LOADING VERIFIED BUNGIE RECORDS';
    await manifestReady;
    const presentationDefinitions=await guardianManifest.getMany('DestinyPresentationNodeDefinition',Object.keys(nodes));
    const resolved=Object.entries(nodes).map(([hash,node])=>({hash,node,definition:presentationDefinitions[hash]})).filter(item=>item.definition);
    const definitionByHash=Object.fromEntries(resolved.map(item=>[String(item.hash),item.definition]));
    const recordsRoot=resolved.find(item=>!(item.definition?.parentNodeHashes||[]).length&&(item.definition?.children?.presentationNodes||[]).length>2&&(item.definition?.children?.presentationNodes||[]).some(entry=>{const definition=definitionByHash[String(entry.presentationNodeHash)];return definition?.displayProperties?.name===item.definition?.displayProperties?.name&&(definition?.children?.presentationNodes||[]).length;}));
    const characters=payload?.profile?.characters?.data||{};
    const character=characters[selectedCharacterId]||Object.values(characters).sort((left,right)=>String(right?.dateLastPlayed||'').localeCompare(String(left?.dateLastPlayed||'')))[0];
    const characterId=String(character?.characterId||'');
    if(recordsRoot){
      sections=recordsFrameworkSections({...payload,journeyRecordOverview:{...(payload?.journeyRecordOverview||{}),records:{sections:[{key:'medals'},{key:'patterns-catalysts'},{key:'lore',available:true},{key:'stat-trackers'}]}}});
      const roots=(recordsRoot.definition?.children?.presentationNodes||[]).map(entry=>definitionByHash[String(entry.presentationNodeHash)]).filter(Boolean);
      for(const [sectionKey,rootName,recordKind] of [['medals','Medals','medals'],['lore','Lore','lore'],['patterns-catalysts','Exotic Catalysts','catalysts']]){
        const root=roots.find(definition=>definition?.displayProperties?.name===rootName);
        const currentEntry=(root?.children?.presentationNodes||[]).find(entry=>definitionByHash[String(entry.presentationNodeHash)]?.displayProperties?.name===rootName);
        const currentDefinition=definitionByHash[String(currentEntry?.presentationNodeHash||'')];
        if(!currentDefinition)continue;
        const categories=await presentationRecordCategories(currentDefinition?.children?.presentationNodes||[],nodes,characterId,recordKind);
        const currentNode=nodes[String(currentEntry.presentationNodeHash)];
        const section=sections.find(item=>item.key===sectionKey);
        if(sectionKey==='patterns-catalysts'){
          const catalysts=section?.types?.find(type=>type.key==='catalysts');
          if(catalysts)Object.assign(catalysts,{icon:bungiePresentationIcon(currentDefinition),completed:finiteNumber(currentNode?.progressValue),total:finiteNumber(currentNode?.completionValue),categories});
        }else if(section)Object.assign(section,{icon:bungiePresentationIcon(currentDefinition),completed:finiteNumber(currentNode?.progressValue),total:finiteNumber(currentNode?.completionValue),categories});
      }
    }
  }
  const characterId=String(journeyCharacterFor(payload)?.characterId||'');
  const [patternTypes,statTrackers]=await Promise.all([
    verifiedCraftablePatternTypes(payload,characterId),
    verifiedStatTrackerSection(payload)
  ]);
  mergeVerifiedPatternTypes(sections.find(section=>section.key==='patterns-catalysts'),patternTypes);
  const statTrackerSection=sections.find(section=>section.key==='stat-trackers');
  if(statTrackerSection&&statTrackers)Object.assign(statTrackerSection,statTrackers);
  renderJourneyRecordList(recordsSections,sections,'Record sections are unavailable.',showRecordsDetail);
  if(recordsStatus)recordsStatus.textContent=`${sections.length} RECORD SECTIONS${sections.some(section=>section.key==='lore')?'':' · LORE AWAITING VERIFIED DATA'}`;
}

function setRecordSelectorState(view){
  [[titlesOpen,'titles'],[badgesOpen,'badges'],[triumphsOpen,'triumphs'],[guardianRankOpen,'guardian-rank'],[recordsOpen,'records']].forEach(([button,key])=>{
    if(!button)return;
    const selected=view===key;
    button.setAttribute('aria-current',String(selected));
    button.setAttribute('aria-expanded',String(selected));
  });
  locationSelector?.querySelectorAll('.apx-loc[data-loc]').forEach(button=>button.setAttribute('aria-current','false'));
}

function showGuardianRecordPanel(view){
  if(!destinationDetail||!recordsPanel||!['titles','badges','triumphs','guardian-rank','records'].includes(view))return;
  const destinationHeight=Math.ceil(destinationDetail.getBoundingClientRect().height);
  if(destinationHeight>0)recordsPanel.style.height=`${destinationHeight}px`;
  destinationDetail.hidden=true;
  recordsPanel.hidden=false;
  activateRecordView(view);
  if(view==='titles'||view==='badges'||view==='triumphs'){
    if(verifiedProfile)void bindTitleTriumphPanel(verifiedProfile,view);
    else if(recordsStatus)recordsStatus.textContent='AWAITING VERIFIED BUNGIE RECORDS';
  }else if(view==='guardian-rank')void bindGuardianRankPanel(verifiedProfile||{});
  else void bindRecordsPanel(verifiedProfile||{});
  recordsBack?.focus();
}

function handleRecordBack(){
  if(activeRecordView==='title-detail'){activateRecordView(selectedTitleKind);selectedTitle=null;return;}
  if(activeRecordView==='triumph-detail'){activateRecordView('triumphs');selectedTriumphCategory=null;return;}
  if(activeRecordView==='records-detail'){activateRecordView('records');selectedRecordSection=null;return;}
  showDestinationPanel();
}

function showDestinationPanel(returnFocus=true){
  const previousRoot=recordRootView(activeRecordView);
  titleTriumphRequest+=1;
  if(!destinationDetail||!recordsPanel)return;
  recordsPanel.hidden=true;
  recordsPanel.style.removeProperty('height');
  destinationDetail.hidden=false;
  if(focusHeading)focusHeading.textContent='Destination focus';
  if(focusStatus)focusStatus.textContent='PERMANENT CENTRE';
  activeRecordView='';
  setRecordSelectorState('');
  const currentLocation=globalThis.AstrixDestinations?.current();
  locationSelector?.querySelector(`.apx-loc[data-loc="${currentLocation}"]`)?.setAttribute('aria-current','true');
  if(returnFocus)({titles:titlesOpen,badges:badgesOpen,triumphs:triumphsOpen,'guardian-rank':guardianRankOpen,records:recordsOpen}[previousRoot])?.focus();
}

async function bindRecentActivity(session){
  const fallback=resetRecentActivity();
  if(!recentActivityCard||session?.authenticated!==true||!selectedCharacterId)return;
  const requestId=++recentActivityRequest;
  try{
    await manifestReady;
    const membership=session?.activeDestinyMembership;
    if(!membership?.membershipType||!membership?.membershipId)return;
    const url=new URL('/bungie/activity-history',AUTH_ORIGIN);
    url.searchParams.set('membershipType',String(membership.membershipType));
    url.searchParams.set('membershipId',String(membership.membershipId));
    url.searchParams.set('characterId',selectedCharacterId);
    url.searchParams.set('page','0');
    if(guardianManifest.status().mode==='indexeddb')url.searchParams.set('definitions','client-manifest');
    const response=await fetch(url,{credentials:'include',headers:{Accept:'application/json'}});
    if(!response.ok)return;
    const payload=await response.json();
    const rows=payload?.Response?.activities??payload?.response?.activities??payload?.activities;
    if(!Array.isArray(rows)||!rows.length)return;
    const activities=await Promise.all(rows.slice(0,5).map(async activity=>({activity,name:await resolveActivityName(activity)})));
    if(requestId!==recentActivityRequest)return;
    const list=document.createElement('div');
    list.dataset.journeyRecentList='';
    for(const {activity,name} of activities){
      const row=document.createElement('p');
      const period=typeof activity?.period==='string'&&activity.period?new Date(activity.period):null;
      const date=period&&!Number.isNaN(period.getTime())?activityDateFormatter.format(period):'DATE NOT RETURNED';
      const completed=finiteNumber(activity?.values?.completed?.basic?.value);
      const state=completed===null?'COMPLETION NOT RETURNED':completed!==0?'COMPLETED':'NOT COMPLETED';
      row.textContent=`${name} · ${date} · ${state}`;
      list.appendChild(row);
    }
    if(fallback)fallback.hidden=true;
    recentActivityCard.appendChild(list);
  }catch{}
}

const historicalValue=(mode,key)=>finiteNumber(mode?.allTime?.[key]?.basic?.value);

function resetMetric(element,text){
  if(!element)return;
  element.textContent='—';
  const card=element.closest('.mission-metric-card');
  const label=element.nextElementSibling;
  if(label)label.textContent=text;
  const tick=card?.querySelector('.mission-verified-tick');
  if(tick)tick.hidden=true;
}

function setMetric(element,value,label){
  if(!element)return;
  element.textContent=value;
  if(element.nextElementSibling)element.nextElementSibling.textContent=label;
  const tick=element.closest('.mission-metric-card')?.querySelector('.mission-verified-tick');
  if(tick)tick.hidden=false;
}

async function bindHistoricalStats(session){
  resetMetric(metricActivities,'Awaiting live history');
  resetMetric(metricCompletion,'Awaiting completion evidence');
  resetMetric(metricPve,'Awaiting PVE evidence');
  resetMetric(metricPvp,'Awaiting PVP evidence');
  if(session?.authenticated!==true)return;
  const requestId=++historicalStatsRequest;
  try{
    const response=await fetch(new URL('/bungie/historical-stats',AUTH_ORIGIN),{credentials:'include',headers:{Accept:'application/json'}});
    if(!response.ok)return;
    const payload=await response.json();
    if(requestId!==historicalStatsRequest)return;
    const results=payload?.Response?.mergedAllCharacters?.results
      ??payload?.response?.mergedAllCharacters?.results
      ??payload?.mergedAllCharacters?.results
      ??payload?.results;
    const pve=results?.allPvE;
    const pvp=results?.allPvP;
    const pveEntered=historicalValue(pve,'activitiesEntered');
    const pvpEntered=historicalValue(pvp,'activitiesEntered');
    const pveCleared=historicalValue(pve,'activitiesCleared');
    const pvpCleared=historicalValue(pvp,'activitiesCleared');
    const kd=historicalValue(pvp,'killsDeathsRatio');
    if(pveEntered!==null&&pvpEntered!==null)setMetric(metricActivities,numberFormatter.format(pveEntered+pvpEntered),'Verified career total');
    if(pveEntered!==null&&pveEntered>0&&pveCleared!==null)setMetric(metricCompletion,`${Math.round(pveCleared/pveEntered*100)}%`,'Verified PvE completion');
    if(pveCleared!==null)setMetric(metricPve,numberFormatter.format(pveCleared),'Verified career clears');
    if(kd!==null)setMetric(metricPvp,kd.toFixed(2),'Verified career K/D');
  }catch{}
}

function trendPath(values,maxValue){
  if(values.length<2||!Number.isFinite(maxValue)||maxValue<=0)return '';
  return values.map((value,index)=>{
    const x=18+(index/(values.length-1))*290;
    const y=134-(Math.max(0,Math.min(maxValue,value))/maxValue)*114;
    return `${index?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

async function bindCurrentForm(session){
  if(!trendChart||!trendEmpty||session?.authenticated!==true||!selectedCharacterId)return;
  const requestId=++currentFormRequest;
  trendChart.querySelectorAll('.mission-chart-line').forEach(path=>path.setAttribute('d',''));
  trendEmpty.hidden=false;
  try{
    const membership=session?.activeDestinyMembership;
    if(!membership?.membershipType||!membership?.membershipId)return;
    const url=new URL('/bungie/activity-history',AUTH_ORIGIN);
    url.searchParams.set('membershipType',String(membership.membershipType));
    url.searchParams.set('membershipId',String(membership.membershipId));
    url.searchParams.set('characterId',selectedCharacterId);
    url.searchParams.set('page','0');
    const response=await fetch(url,{credentials:'include',headers:{Accept:'application/json'}});
    if(!response.ok)return;
    const payload=await response.json();
    const rows=payload?.Response?.activities??payload?.response?.activities??payload?.activities;
    if(!Array.isArray(rows)||!rows.length||requestId!==currentFormRequest)return;
    const cutoff=Date.now()-30*24*60*60*1000;
    const buckets=new Map();
    for(const activity of rows){
      const date=new Date(activity?.period||'');
      if(Number.isNaN(date.getTime())||date.getTime()<cutoff)continue;
      const day=date.toISOString().slice(0,10);
      if(!buckets.has(day))buckets.set(day,{day,pveTotal:0,pveCleared:0,kills:0,deaths:0,pvpEvidence:false});
      const bucket=buckets.get(day);
      const mode=finiteNumber(activity?.activityDetails?.mode);
      if(mode===null)continue;
      const values=activity?.values||{};
      if(PVP_MODES.has(mode)){
        const kills=finiteNumber(values?.kills?.basic?.value);
        const deaths=finiteNumber(values?.deaths?.basic?.value);
        if(kills!==null&&deaths!==null){bucket.kills+=kills;bucket.deaths+=deaths;bucket.pvpEvidence=true;}
      }else if(!GAMBIT_MODES.has(mode)){
        const completed=finiteNumber(values?.completed?.basic?.value);
        if(completed!==null){bucket.pveTotal+=1;if(completed!==0)bucket.pveCleared+=1;}
      }
    }
    const daily=[...buckets.values()].sort((left,right)=>left.day.localeCompare(right.day));
    const pve=daily.filter(day=>day.pveTotal>0).map(day=>day.pveCleared/day.pveTotal*100);
    const pvp=daily.filter(day=>day.pvpEvidence&&day.deaths>0).map(day=>day.kills/day.deaths);
    const pvePath=trendPath(pve,100);
    const pvpPath=trendPath(pvp,Math.max(1,...pvp));
    if(requestId!==currentFormRequest||(!pvePath&&!pvpPath))return;
    trendChart.querySelector('[data-journey-trend="pve"]')?.setAttribute('d',pvePath);
    trendChart.querySelector('[data-journey-trend="pvp"]')?.setAttribute('d',pvpPath);
    trendChart.setAttribute('aria-label','Verified 30-day PVE success and PVP K/D trends');
    trendEmpty.hidden=true;
    const dates=trendChart.closest('.mission-current-form')?.querySelectorAll('.mission-chart-dates span');
    if(dates?.length===2&&daily.length){
      dates[0].textContent=activityDateFormatter.format(new Date(`${daily[0].day}T00:00:00Z`));
      dates[1].textContent=activityDateFormatter.format(new Date(`${daily[daily.length-1].day}T00:00:00Z`));
    }
  }catch{}
}

async function bindTitleAndProgression(payload){
  const requestId=++profileIdentityRequest;
  if(titleSealCard)titleSealCard.textContent='No verified title or seal source is connected to Journey.';
  if(titleProgressCard)titleProgressCard.textContent='Title progression data is not connected.';
  if(triumphStatsCard)triumphStatsCard.textContent='No verified Triumph or progression values are available.';

  const characters=payload?.profile?.characters?.data||{};
  const character=characters[selectedCharacterId]
    ||Object.values(characters).sort((left,right)=>String(right?.dateLastPlayed||'').localeCompare(String(left?.dateLastPlayed||'')))[0];
  const characterId=String(character?.characterId||'');
  const titleHash=finiteNumber(character?.titleRecordHash);
  if(titleSealCard&&titleHash!==null){
    const definition=await resolveManifestDefinition('DestinyRecordDefinition',titleHash);
    if(requestId!==profileIdentityRequest)return;
    const genderHash=String(character?.genderHash||'');
    const titleName=String(definition?.titleInfo?.titlesByGenderHash?.[genderHash]
      ||definition?.titleInfo?.titlesByGender?.[character?.genderType]
      ||definition?.displayProperties?.name||'').trim();
    const profileRecord=payload?.profile?.profileRecords?.data?.records?.[String(titleHash)];
    const characterRecord=payload?.profile?.characterRecords?.data?.[characterId]?.records?.[String(titleHash)];
    const record=characterRecord||profileRecord;
    if(titleName){
      const state=finiteNumber(record?.state);
      const gilded=state!==null&&(state&128)===128;
      const completedCount=finiteNumber(record?.completedCount);
      const gildLabel=gilded?(completedCount!==null?` · GILDED ×${numberFormatter.format(completedCount)}`:' · GILDED'):'';
      titleSealCard.textContent=`${titleName.toUpperCase()}${gildLabel}`;
    }
  }

  const records=payload?.profile?.profileRecords?.data;
  const lifetimeScore=finiteNumber(records?.lifetimeScore);
  if(triumphStatsCard&&lifetimeScore!==null){
    const activeScore=finiteNumber(records?.activeScore);
    const legacyScore=finiteNumber(records?.legacyScore);
    const detail=[activeScore!==null?`ACTIVE ${numberFormatter.format(activeScore)}`:'',legacyScore!==null?`LEGACY ${numberFormatter.format(legacyScore)}`:''].filter(Boolean).join(' · ');
    triumphStatsCard.textContent=`TRIUMPH SCORE ${numberFormatter.format(lifetimeScore)}${detail?` · ${detail}`:''}`;
  }

  const nodes=payload?.profile?.profilePresentationNodes?.data?.nodes;
  if(titleProgressCard&&nodes&&typeof nodes==='object'){
    const candidates=Object.entries(nodes).map(([hash,node])=>({
      hash,
      progress:finiteNumber(node?.progressValue),
      completion:finiteNumber(node?.completionValue)
    })).filter(candidate=>candidate.progress!==null&&candidate.completion!==null&&candidate.completion>0&&candidate.progress<candidate.completion)
      .sort((left,right)=>(left.completion-left.progress)-(right.completion-right.progress));
    for(const candidate of candidates){
      const definition=await resolveManifestDefinition('DestinyPresentationNodeDefinition',candidate.hash);
      if(requestId!==profileIdentityRequest)return;
      const name=String(definition?.displayProperties?.name||'').trim();
      if(!name||!finiteNumber(definition?.completionRecordHash))continue;
      titleProgressCard.textContent=`${numberFormatter.format(candidate.progress)} / ${numberFormatter.format(candidate.completion)} TO ${name.toUpperCase()}`;
      break;
    }
  }
}

function bindProfileCards(payload){
  bindFavouriteCharacter(payload);bindVault(payload);bindMilestones(payload);bindActiveGuardian(payload);bindGuardianRank(payload);void bindTitleAndProgression(payload);
  if(recordsPanel&&!recordsPanel.hidden){
    const root=recordRootView(activeRecordView);
    if(root==='titles'||root==='badges'||root==='triumphs')void bindTitleTriumphPanel(payload,root);
    else if(root==='guardian-rank')bindGuardianRankPanel(payload);
    else if(root==='records')bindRecordsPanel(payload);
  }
}

function renderJourneyContext(){
  dashboard.dataset.journeyView=activeView;
  if(selectedCharacterId)dashboard.dataset.characterId=selectedCharacterId;
  else delete dashboard.dataset.characterId;
  document.querySelectorAll('[data-journey-character-panel]').forEach(panel=>{
    panel.dataset.characterId=selectedCharacterId;
    panel.dataset.journeyView=activeView;
    panel.dataset.timeFilter=timeFilter;
  });
  const guardian=selectedClassName||'GUARDIAN';
  const period=timeFilter==='30-days'?'LAST 30 DAYS':'ALL TIME';
  feedStatus.textContent=`${guardian} · ${activeView.toUpperCase()} · ${period} · AWAITING VERIFIED ACTIVITY DATA`;
  document.querySelectorAll('[data-journey-metric]').forEach(card=>{
    const lens=card.dataset.journeyMetric;
    card.hidden=activeView==='pve'&&lens==='pvp'||activeView==='pvp'&&lens==='pve';
  });
  document.querySelectorAll('[data-journey-trend]').forEach(item=>{
    const lens=item.dataset.journeyTrend;
    item.hidden=activeView==='pve'&&lens==='pvp'||activeView==='pvp'&&lens==='pve';
  });
  const lensName=activeView==='pve'?'PVE ':activeView==='pvp'?'PVP ':'';
  trendEmpty.textContent=`${lensName}performance trends require live dated activity evidence.`;
  if(verifiedProfile)bindProfileCards(verifiedProfile);
}

function selectJourneyCharacter(characterId,className){
  selectedCharacterId=String(characterId||'');
  selectedClassName=String(className||'').toUpperCase();
  renderJourneyContext();
  if(verifiedProfile)void bindDestinationProgress(verifiedProfile);
  if(journeySession)void bindRecentActivity(journeySession);
  if(journeySession)void bindCurrentForm(journeySession);
}

function syncSelectedCharacterFromCards(){
  const selected=heroCards?.querySelector('.guardian-character-card.is-selected');
  if(!selected)return;
  selectJourneyCharacter(selected.dataset.characterId,selected.dataset.class);
}

function selectJourneyView(view){
  const button=document.querySelector(`[data-journey-view="${view}"]`);
  if(!button)return;
  activeView=button.dataset.journeyView;
  document.querySelectorAll('[data-journey-view]').forEach(item=>item.setAttribute('aria-selected',String(item===button)));
  renderJourneyContext();
}

document.querySelectorAll('[data-journey-view]').forEach(button=>button.addEventListener('click',()=>{
  selectJourneyView(button.dataset.journeyView);
}));

titlesOpen?.addEventListener('click',()=>showGuardianRecordPanel('titles'));
badgesOpen?.addEventListener('click',()=>showGuardianRecordPanel('badges'));
triumphsOpen?.addEventListener('click',()=>showGuardianRecordPanel('triumphs'));
guardianRankOpen?.addEventListener('click',()=>showGuardianRecordPanel('guardian-rank'));
recordsOpen?.addEventListener('click',()=>showGuardianRecordPanel('records'));
recordsBack?.addEventListener('click',handleRecordBack);
locationSelector?.addEventListener('click',event=>{if(event.target.closest('.apx-loc[data-loc]'))showDestinationPanel(false);});

document.querySelectorAll('.journey-section-nav a').forEach(link=>link.addEventListener('click',()=>{
  document.querySelectorAll('.journey-section-nav a').forEach(item=>{
    const active=item===link;
    item.classList.toggle('is-active',active);
    if(active)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  });
  const view=link.dataset.journeyViewLink;
  if(view)selectJourneyView(view);
}));

document.querySelectorAll('input[name="journeyTime"]').forEach(input=>input.addEventListener('change',()=>{
  if(!input.checked)return;
  timeFilter=input.value;
  renderJourneyContext();
}));

document.addEventListener('astrix:character-selected',event=>{
  selectJourneyCharacter(event.detail?.characterId,event.detail?.className||event.detail?.characterClass);
});
document.addEventListener('astrix:destination-changed',event=>{if(verifiedProfile)void bindDestinationProgress(verifiedProfile,event.detail?.key);});

if(heroCards){
  new MutationObserver(syncSelectedCharacterFromCards).observe(heroCards,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}

function hasJourneyRecordComponents(payload){
  return payload?.profile?.metrics?.data&&payload?.profile?.characterCraftables?.data;
}

async function readVerifiedProfile(session){
  const cached=await readCachedBungieProfile(session);
  if(cached?.profile?.characters?.data&&hasJourneyRecordComponents(cached))return cached;
  return new Promise(async resolve=>{
    let settled=false;
    const fallback=cached?.profile?.characters?.data?cached:null;
    const finish=(payload,force=false)=>{
      if(settled)return;
      const verified=payload?.profile?.characters?.data?payload:fallback;
      if(!force&&!hasJourneyRecordComponents(verified))return;
      settled=true;
      document.removeEventListener('astrix:bungie-profile-loaded',onLoaded);
      document.removeEventListener('astrix:profile-error',onError);
      resolve(verified);
    };
    const onLoaded=event=>readCachedBungieProfile(session).then(payload=>finish(payload,event.detail?.sessionCacheRestored!==true)).catch(()=>finish(null,true));
    const onError=()=>finish(null,true);
    document.addEventListener('astrix:bungie-profile-loaded',onLoaded);
    document.addEventListener('astrix:profile-error',onError);
    try{
      await import('../guardian-workspace-v2/guardian-bungie-profile.mjs?v=20260829-subclass-identity-1-build-handoff-storage-order-1');
      const loaded=await readCachedBungieProfile(session);
      if(loaded?.profile?.characters?.data)finish(loaded);
    }catch(error){
      console.info('[ASTRIX Journey] verified Bungie profile unavailable',error);
      finish(null,true);
    }
  });
}

function showSignedOut(){
  location.replace('https://astrixparadox.com/astrix-app/pages/guardian-workspace-v2/');
}

let locationSelectorReady=false;
let locationMapReady=Promise.resolve();
function showJourney(){
  resolving.hidden=true;
  signedOut.hidden=true;
  dashboard.hidden=false;
  status.textContent='AUTHENTICATED JOURNEY';
  renderJourneyContext();
  if(!locationSelectorReady){
    locationSelectorReady=true;
    // Reactive art-backdrop atmosphere + destination selector. Honest empty checklist
    // until a verified data provider (opts.getChecklist) is wired with the mechanics.
    initLocationSelector({
      mount:document.getElementById('journeyLocationSelector'),
      detail:document.getElementById('journeyLocationDetail')
    });
    locationMapReady=initJourneyLocationMaps(document.getElementById('journeyLocationDetail'));
  }
  return locationMapReady;
}

try{
  globalThis.AstrixLoader.set(12);globalThis.AstrixLoader.status('Connecting Journey');
  const session=await getBungieSession();
  const authenticated=session?.authenticated===true&&globalThis.ASTRIX_BUNGIE_SESSION?.authenticated===true;
  if(authenticated){
    journeySession=session;
    void bindHistoricalStats(session);
    const heroCardsReady=waitForHeroCards();
    const mapReady=showJourney();
    const profile=await readVerifiedProfile(session);
    if(profile){
      verifiedProfile=profile;
      bindProfileCards(profile);
      void bindDestinationProgress(profile);
    }
    await Promise.all([heroCardsReady,mapReady,waitForJourneyAtmosphere()]);
    globalThis.AstrixLoader.set(96);globalThis.AstrixLoader.status('Journey rendered');
    await globalThis.AstrixLoader.ready(document);
  }
  else showSignedOut();
}catch(error){
  console.info('[ASTRIX Journey] existing Bungie session unavailable',error);
  showSignedOut();
}
