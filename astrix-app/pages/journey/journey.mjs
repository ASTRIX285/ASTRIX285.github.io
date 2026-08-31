import {AUTH_ORIGIN,getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs';
import {guardianManifest} from '../guardian-workspace-v2/guardian-manifest-service.mjs';
import {readCachedBungieProfile} from '../guardian-workspace-v2/guardian-session-cache.mjs';
import {initLocationSelector} from '../../shared/astrix-location-selector.mjs';
import {initJourneyLocationMaps} from './journey-location-maps.mjs?v=20260830-all-destination-progress';

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

function bindProfileCards(payload){bindFavouriteCharacter(payload);bindVault(payload);bindMilestones(payload);bindActiveGuardian(payload);bindGuardianRank(payload);void bindTitleAndProgression(payload);}

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
