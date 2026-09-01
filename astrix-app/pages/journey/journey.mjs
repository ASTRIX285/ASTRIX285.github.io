import {AUTH_ORIGIN,getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs';
import {guardianManifest} from '../guardian-workspace-v2/guardian-manifest-service.mjs';
import {readCachedBungieProfile} from '../guardian-workspace-v2/guardian-session-cache.mjs';
import {initLocationSelector} from '../../shared/astrix-location-selector.mjs';
import {initJourneyLocationMaps} from './journey-location-maps.mjs?v=20260901-destination-data-panels';

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
const triumphsOpen=document.getElementById('journeyTriumphsOpen');
const guardianRankOpen=document.getElementById('journeyGuardianRankOpen');
const recordsOpen=document.getElementById('journeyRecordsOpen');
const recordsPanel=document.getElementById('journeyRecordsPanel');
const recordsBack=document.getElementById('journeyRecordsBack');
const recordsStatus=document.getElementById('journeyRecordsStatus');
const titlesList=document.getElementById('journeyTitlesList');
const titleDetailHero=document.getElementById('journeyTitleDetailHero');
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
let activeRecordView='';
let selectedTitle=null;
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
const STAT_TRACKER_CATEGORIES=['Seasons','Account','Crucible','Destination','Gambit','Raids','Strikes','Trials of Osiris'];
const MISSION_REPORT_FILTERS=new Set(['view','category','mode','activity','activityHash','metricHash','trackerHash','period']);

function missionReportHref(filters){
  if(!filters||typeof filters!=='object')return '';
  const url=new URL('../mission-reports/',globalThis.location.href);
  Object.entries(filters).forEach(([key,value])=>{
    if(MISSION_REPORT_FILTERS.has(key)&&value!==null&&value!==undefined&&String(value).trim())url.searchParams.set(key,String(value));
  });
  return url.search?url.toString():'';
}

function makeJourneyRecordRow({hash,name,icon,description='',completed=null,total=null,unit='',gilded=false,complete=false,crafted=false,value=null,onSelect=null,missionReportFilters=null}){
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
  title.textContent=`${name}${gilded?' · GILDED':crafted?' · CRAFTED':''}`;
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
  const source=view==='titles'?payload?.journeyRecordOverview?.titles:payload?.journeyRecordOverview?.triumphCategories;
  if(!Array.isArray(source))return null;
  return source.map(item=>{
    if(view==='titles'){
      const requirements=Array.isArray(item?.requirements)?item.requirements.map(row=>normalizedProgressItem(row,'OBJECTIVES')).filter(row=>row.name):[];
      const usesRequirements=item?.completedRequirements!==undefined||item?.totalRequirements!==undefined||requirements.length>0;
      const completed=finiteNumber(item?.completedRequirements??item?.completedActivities);
      const total=finiteNumber(item?.totalRequirements??item?.totalActivities);
      return {
        hash:item?.presentationNodeHash,
        name:String(item?.titleName||item?.name||'').trim(),
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
  if(view==='title-detail')return 'titles';
  if(view==='triumph-detail')return 'triumphs';
  if(view==='records-detail')return 'records';
  return view;
}

function activateRecordView(view){
  activeRecordView=view;
  recordsPanel?.querySelectorAll('[data-journey-record-view]').forEach(group=>group.hidden=group.dataset.journeyRecordView!==view);
  const root=recordRootView(view);
  const headings={titles:'Titles',triumphs:'Triumphs','guardian-rank':'Guardian Rank',records:'Records'};
  if(focusHeading)focusHeading.textContent=headings[root]||'Guardian Records';
  if(focusStatus)focusStatus.textContent='VERIFIED BUNGIE RECORDS';
  if(recordsBack)recordsBack.textContent=view==='title-detail'?'Back to Titles':view==='triumph-detail'?'Back to Triumph Categories':view==='records-detail'?'Back to Records':'Back to Destination';
  setRecordSelectorState(root);
}

function showTitleDetail(title){
  selectedTitle=title;
  activateRecordView('title-detail');
  const detailName=title.detailName||title.name;
  const description=[title.description,title.name!==detailName?`TITLE · ${title.name}`:''].filter(Boolean).join(' · ');
  renderDetailHero(titleDetailHero,{name:detailName,icon:title.icon,description,completed:title.completed,total:title.total,unit:'TITLE PROGRESS'});
  renderJourneyRecordList(titleRequirementsList,title.requirements||[],'Verified requirements for this title are not yet connected.');
}

function showTriumphDetail(category){
  selectedTriumphCategory=category;
  activateRecordView('triumph-detail');
  renderDetailHero(triumphDetailHero,{name:category.name,icon:category.icon,description:category.description,completed:category.completed,total:category.total,unit:'TRIUMPHS'});
  renderSubmenu(triumphSubcategories,category.subcategories||[],section=>{
    renderJourneyRecordList(triumphDetailList,section.items||[],'Verified Triumphs for this subcategory are not yet connected.');
  });
  if(!(category.subcategories||[]).length)renderJourneyRecordList(triumphDetailList,[],'Verified Triumph subcategories are not yet connected.');
}

async function bindTitleTriumphPanel(payload,view=recordRootView(activeRecordView)){
  const requestId=++titleTriumphRequest;
  if(recordsStatus)recordsStatus.textContent='LOADING VERIFIED BUNGIE DEFINITIONS';
  const hookedRows=journeyRecordHookRows(payload,view);
  if(hookedRows){
    renderJourneyRecordList(view==='titles'?titlesList:triumphCategoriesList,hookedRows,view==='titles'?'No verified Destiny title rows were returned.':'No verified Triumph category rows were returned.',view==='titles'?showTitleDetail:showTriumphDetail);
    if(recordsStatus)recordsStatus.textContent=view==='titles'?`${hookedRows.length} TITLES`:`${hookedRows.length} TRIUMPH CATEGORIES`;
    return;
  }
  const nodes=payload?.profile?.profilePresentationNodes?.data?.nodes;
  if(!nodes||typeof nodes!=='object'){
    if(view==='titles')renderJourneyRecordList(titlesList,[],'Title presentation nodes are not present in the verified profile response.');
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
  if(view==='titles'){
    const recordDefinitions=await guardianManifest.getMany('DestinyRecordDefinition',titleCandidates.map(item=>item.definition.completionRecordHash));
    const titles=titleCandidates.map(item=>{
      const completionRecordHash=finiteNumber(item.definition.completionRecordHash);
      const recordDefinition=recordDefinitions[String(completionRecordHash)];
      const name=titleNameFor(recordDefinition,character,item.definition?.displayProperties?.name);
      if(!name||!recordDefinition?.titleInfo)return null;
      const activityProgress=payload?.journeyTitleActivityProgress?.[String(item.hash)];
      const activityCompleted=finiteNumber(activityProgress?.completedActivities);
      const activityTotal=finiteNumber(activityProgress?.totalActivities);
      const hasActivityCounts=activityCompleted!==null&&activityTotal!==null&&activityTotal>0;
      const state=finiteNumber(titleRecordFor(payload,characterId,completionRecordHash)?.state);
      return {hash:item.hash,name,detailName:String(item.definition?.displayProperties?.name||name),icon:bungiePresentationIcon(item.definition),description:String(item.definition?.displayProperties?.description||''),completed:hasActivityCounts?activityCompleted:finiteNumber(item.node?.progressValue),total:hasActivityCounts?activityTotal:finiteNumber(item.node?.completionValue),unit:hasActivityCounts?'ACTIVITIES':'TITLE REQUIREMENTS',gilded:state!==null&&(state&128)===128,requirements:[]};
    }).filter(Boolean).sort((left,right)=>left.name.localeCompare(right.name));
    if(requestId!==titleTriumphRequest)return;
    renderJourneyRecordList(titlesList,titles,'No Destiny title presentation nodes were returned for this profile.',showTitleDetail);
    if(recordsStatus)recordsStatus.textContent=`${titles.length} TITLES`;
    return;
  }
  const titleHashes=new Set(titleCandidates.map(item=>String(item.hash)));
  const categories=resolved.filter(item=>{
    const children=item.definition?.children||{};
    return Number(item.definition?.presentationNodeType)===3&&!titleHashes.has(String(item.hash))&&((children.records?.length||0)+(children.presentationNodes?.length||0)>0);
  }).map(item=>({hash:item.hash,name:String(item.definition?.displayProperties?.name||'').trim(),icon:bungiePresentationIcon(item.definition),description:String(item.definition?.displayProperties?.description||''),completed:finiteNumber(item.node?.progressValue),total:finiteNumber(item.node?.completionValue),unit:'TRIUMPHS',subcategories:[]})).filter(item=>item.name).sort((left,right)=>left.name.localeCompare(right.name));
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

function bindGuardianRankPanel(payload){
  const data=guardianRankRows(payload);
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
      renderDetailHero(guardianRankHero,{name:item.name,icon:item.icon,description:data.currentRank===null?'Current Guardian Rank unavailable':`CURRENT RANK ${data.currentRank}${data.currentRankName?` · ${data.currentRankName}`:''}`,completed:item.completed,total:item.total,unit:'RANK PROGRESS'});
      renderJourneyRecordList(guardianRankObjectives,item.objectives,'Verified objectives for this Guardian Rank are not yet connected.');
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
        return definition.key==='stat-trackers'?{...row,gilded:row.gilded||row.complete}:row;
      }).filter(item=>item.name);
      return {key:String(category?.key||category?.name||''),name:String(category?.name||'').trim(),items:rows};
    }).filter(category=>category.name);
    if(definition.key==='stat-trackers'&&!categories.length)categories=STAT_TRACKER_CATEGORIES.map(name=>({key:name.toLowerCase().replaceAll(' ','-'),name,items:[]}));
    return {key:definition.key,name:String(source.name||definition.name),description:String(source.description||definition.description),icon:bungieIconUrl(source.iconPath),completed,total,unit:completed!==null&&total!==null&&total>0?'RECORDS':'',categories,types:definition.key==='patterns-catalysts'?patternsCatalystsTypes(source):[]};
  }).filter(Boolean);
}

function showRecordsDetail(section){
  selectedRecordSection=section;
  activateRecordView('records-detail');
  renderDetailHero(recordsDetailHero,{name:section.name,icon:section.icon,description:section.description,completed:section.completed,total:section.total,unit:'SECTION PROGRESS'});
  const patternsCatalysts=section.key==='patterns-catalysts';
  recordsDetailGroup?.classList.toggle('is-patterns-catalysts',patternsCatalysts);
  if(recordsTypes)recordsTypes.hidden=!patternsCatalysts;
  if(patternsCatalysts){
    renderRecordTypes(recordsTypes,section.types||[],type=>{
      if(recordsDetailHeading)recordsDetailHeading.textContent=type.name;
      renderSubmenu(recordsSubcategories,type.categories||[],category=>renderJourneyRecordList(recordsDetailList,category.items||[],type.key==='catalysts'?'Verified catalyst progress for this weapon group is not yet connected.':'Verified pattern progress for this weapon type is not yet connected.'));
    });
    return;
  }
  recordsTypes?.replaceChildren();
  if(recordsDetailHeading)recordsDetailHeading.textContent='Record Categories';
  renderSubmenu(recordsSubcategories,section.categories||[],category=>{
    renderJourneyRecordList(recordsDetailList,category.items||[],section.key==='stat-trackers'?'Verified Stat Trackers for this category are not yet connected.':'Verified individual Record progress is not yet connected.');
  });
  if(!(section.categories||[]).length)renderJourneyRecordList(recordsDetailList,[],'Verified Record categories are not yet connected.');
}

function bindRecordsPanel(payload){
  const sections=recordsFrameworkSections(payload);
  renderJourneyRecordList(recordsSections,sections,'Record sections are unavailable.',showRecordsDetail);
  if(recordsStatus)recordsStatus.textContent=`${sections.length} RECORD SECTIONS${sections.some(section=>section.key==='lore')?'':' · LORE AWAITING VERIFIED DATA'}`;
}

function setRecordSelectorState(view){
  [[titlesOpen,'titles'],[triumphsOpen,'triumphs'],[guardianRankOpen,'guardian-rank'],[recordsOpen,'records']].forEach(([button,key])=>{
    if(!button)return;
    const selected=view===key;
    button.setAttribute('aria-current',String(selected));
    button.setAttribute('aria-expanded',String(selected));
  });
  locationSelector?.querySelectorAll('.apx-loc[data-loc]').forEach(button=>button.setAttribute('aria-current','false'));
}

function showGuardianRecordPanel(view){
  if(!destinationDetail||!recordsPanel||!['titles','triumphs','guardian-rank','records'].includes(view))return;
  const destinationHeight=Math.ceil(destinationDetail.getBoundingClientRect().height);
  if(destinationHeight>0)recordsPanel.style.height=`${destinationHeight}px`;
  destinationDetail.hidden=true;
  recordsPanel.hidden=false;
  activateRecordView(view);
  if(view==='titles'||view==='triumphs'){
    if(verifiedProfile)void bindTitleTriumphPanel(verifiedProfile,view);
    else if(recordsStatus)recordsStatus.textContent='AWAITING VERIFIED BUNGIE RECORDS';
  }else if(view==='guardian-rank')bindGuardianRankPanel(verifiedProfile||{});
  else bindRecordsPanel(verifiedProfile||{});
  recordsBack?.focus();
}

function handleRecordBack(){
  if(activeRecordView==='title-detail'){activateRecordView('titles');selectedTitle=null;return;}
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
  if(returnFocus)({titles:titlesOpen,triumphs:triumphsOpen,'guardian-rank':guardianRankOpen,records:recordsOpen}[previousRoot])?.focus();
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
    if(root==='titles'||root==='triumphs')void bindTitleTriumphPanel(payload,root);
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

if(heroCards){
  new MutationObserver(syncSelectedCharacterFromCards).observe(heroCards,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}

async function readVerifiedProfile(session){
  const cached=await readCachedBungieProfile(session);
  if(cached?.profile?.characters?.data)return cached;
  return new Promise(async resolve=>{
    let settled=false;
    const finish=payload=>{
      if(settled)return;
      settled=true;
      document.removeEventListener('astrix:bungie-profile-loaded',onLoaded);
      document.removeEventListener('astrix:profile-error',onError);
      resolve(payload?.profile?.characters?.data?payload:null);
    };
    const onLoaded=()=>readCachedBungieProfile(session).then(finish).catch(()=>finish(null));
    const onError=()=>finish(null);
    document.addEventListener('astrix:bungie-profile-loaded',onLoaded);
    document.addEventListener('astrix:profile-error',onError);
    try{
      await import('../guardian-workspace-v2/guardian-bungie-profile.mjs?v=20260829-subclass-identity-1-build-handoff-storage-order-1');
      const loaded=await readCachedBungieProfile(session);
      if(loaded?.profile?.characters?.data)finish(loaded);
    }catch(error){
      console.info('[ASTRIX Journey] verified Bungie profile unavailable',error);
      finish(null);
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
