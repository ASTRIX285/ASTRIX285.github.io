import {getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs';
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
const verifiedGuardian=document.getElementById('journeyVerifiedGuardian');
const guardianCrest=document.getElementById('journeyGuardianCrest');
const guardianCrestEmpty=document.getElementById('journeyGuardianCrestEmpty');
const totalPlaytime=document.getElementById('journeyTotalPlaytime');
const CLASS_NAMES=['TITAN','HUNTER','WARLOCK'];
const MILESTONES_PENDING='No verified milestone or achievement source is connected.';
const BUNGIE_ORIGIN='https://www.bungie.net';
const numberFormatter=new Intl.NumberFormat('en-GB');
let activeView='overview';
let timeFilter='all';
let selectedCharacterId='';
let selectedClassName='';
let verifiedProfile=null;

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
}

function bindProfileCards(payload){bindFavouriteCharacter(payload);bindVault(payload);bindMilestones(payload);bindActiveGuardian(payload);}

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
    initJourneyLocationMaps(document.getElementById('journeyLocationDetail'));
  }
}

try{
  const session=await getBungieSession();
  const authenticated=session?.authenticated===true&&globalThis.ASTRIX_BUNGIE_SESSION?.authenticated===true;
  if(authenticated){
    showJourney();
    const profile=await readVerifiedProfile(session);
    if(profile){
      verifiedProfile=profile;
      bindProfileCards(profile);
    }
  }
  else showSignedOut();
}catch(error){
  console.info('[ASTRIX Journey] existing Bungie session unavailable',error);
  showSignedOut();
}
