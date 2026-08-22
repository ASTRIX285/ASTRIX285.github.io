/* guardian-artifact.mjs — Guardian Build Forge Artifact ownership.
 * Live Bungie state is authoritative for live Guardians/loadouts.
 * Fixture/DIM test builds fall back to the beta manifest picker.
 */
import { resolveArtifactViewState } from './guardian-artifact-state.mjs';

const MANIFEST_URL='../../data/paradox-forge/beta/beta-bungie-manifest-cache.json';
const BUNGIE_ROOT='https://www.bungie.net';
const MAX_PERKS=12;
const PANEL_ICONS=7;
const OVERRIDE_KEY='astrix-paradox-artifact-overrides';

const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const absIcon=v=>{const s=String(v??'').trim();return !s?'':(s.startsWith('http')?s:`${BUNGIE_ROOT}${s}`);};
const hashOf=item=>Number(item?.hash??item?.bungieHash??item?.itemHash);

let manifest=null;
let artifactDef=null;
let currentFixtureId=null;
let selected=[];
let currentMode='fixture';
let currentArtifactState='intended';
let liveArtifact=null;
let livePerksByHash=new Map();

async function ensureManifest(){
  if(manifest)return;
  const res=await fetch(MANIFEST_URL,{cache:'no-store'});
  if(!res.ok)throw new Error(`Artifact manifest load failed: ${res.status}`);
  manifest=await res.json();
  artifactDef=Object.values(manifest.artifacts??{})[0]??null;
}

function fixtureArtifactIdentity(){
  if(!artifactDef)return null;
  return {
    hash:Number(artifactDef.bungieHash??artifactDef.hash??0),
    name:artifactDef.display?.name||'Seasonal Artifact',
    description:artifactDef.display?.description||'',
    icon:absIcon(artifactDef.display?.icon)
  };
}

function artifactIdentity(){
  if(currentMode==='live'&&liveArtifact){
    return {
      ...liveArtifact,
      hash:hashOf(liveArtifact),
      name:liveArtifact.name||liveArtifact.displayProperties?.name||'Seasonal Artifact',
      description:liveArtifact.description||liveArtifact.displayProperties?.description||'',
      icon:absIcon(liveArtifact.icon||liveArtifact.displayProperties?.icon)
    };
  }
  return fixtureArtifactIdentity();
}

function fixturePerkIdentity(hash){
  const row=manifest?.inventoryItems?.[String(hash)]??null;
  if(!row||!row.display?.name)return {hash:Number(hash),name:`Unresolved perk ${hash}`,description:'',icon:'',unresolved:true};
  return {hash:Number(hash),name:row.display.name,description:row.display.description||'',icon:absIcon(row.display.icon),unresolved:false};
}

function perkIdentity(hash){
  const live=livePerksByHash.get(Number(hash));
  if(currentMode==='live'&&live){
    return {
      ...live,
      hash:Number(hash),
      name:live.name||live.displayProperties?.name||`Artifact perk ${hash}`,
      description:live.description||live.displayProperties?.description||'',
      icon:absIcon(live.icon||live.displayProperties?.icon),
      unresolved:false
    };
  }
  return fixturePerkIdentity(hash);
}

function tierList(){
  return (artifactDef?.tiers??[]).map(t=>({tier:Number(t.tier??0),perks:(t.itemHashes??[]).map(fixturePerkIdentity)}));
}

function loadOverrides(){try{return JSON.parse(localStorage.getItem(OVERRIDE_KEY)||'{}')||{};}catch{return {};}}
function saveOverride(fixtureId,hashes){if(!fixtureId)return;const all=loadOverrides();all[fixtureId]=hashes.slice();try{localStorage.setItem(OVERRIDE_KEY,JSON.stringify(all));}catch{}}
function selectionForFixture(detail){
  const overrides=loadOverrides();
  if(currentFixtureId&&Array.isArray(overrides[currentFixtureId]))return overrides[currentFixtureId].map(Number).filter(Number.isFinite);
  const perks=detail?.artifact?.perks;
  return Array.isArray(perks)?perks.map(p=>Number(p?.hash??p?.bungieHash)).filter(Number.isFinite):[];
}

function renderArtifactDisplay(){
  const id=artifactIdentity();
  const nameEl=qs('#artName');
  const iconEl=qs('#artIcon');
  const perksEl=qs('#artPerks');
  const row=qs('.artifact-row');

  if(!id){
    if(nameEl)nameEl.textContent='Artifact unresolved';
    if(iconEl){iconEl.removeAttribute('src');iconEl.style.opacity='0';}
    if(perksEl){perksEl.dataset.artifactState='unresolved';perksEl.innerHTML=Array.from({length:PANEL_ICONS},()=>'<span class="rail-empty-slot"></span>').join('');}
    return;
  }

  if(nameEl)nameEl.textContent=id.name;
  if(iconEl){iconEl.src=id.icon||'';iconEl.alt=id.name;iconEl.style.opacity=id.icon?'1':'0';}
  if(row){
    row.dataset.artifactMode=currentMode;
    row.setAttribute('aria-label',currentMode==='live'?'Live Bungie Artifact':'Configure Artifact perks');
    row.style.cursor=currentMode==='live'?'default':'pointer';
  }

  const stateUnavailable=currentMode==='live'&&currentArtifactState==='state-unavailable';
  const perks=stateUnavailable?[]:selected.map(perkIdentity);
  if(perksEl){
    perksEl.dataset.artifactState=stateUnavailable?'state-unavailable':(perks.length?'active':'none-active');
    perksEl.title=stateUnavailable?'Live Artifact activation state is unavailable.':(perks.length?`${perks.length} active Artifact perk(s) resolved from Bungie`:(currentMode==='live'?'Bungie reports no active Artifact perks':'No fixture Artifact perks selected'));
    if(!perks.length){
      perksEl.innerHTML=currentMode==='live'
        ? (stateUnavailable?'<span class="art-empty">ARTIFACT STATE UNAVAILABLE</span>':Array.from({length:PANEL_ICONS},()=>'<span class="rail-empty-slot"></span>').join(''))
        : '<button type="button" class="art-empty" tabindex="-1">Choose Artifact perks</button>';
    }else{
      const shown=perks.slice(0,PANEL_ICONS);
      perksEl.innerHTML=shown.map(p=>p.icon
        ? `<span class="artifact-perk" title="${esc(p.name)}" aria-label="${esc(p.name)}"><img src="${esc(p.icon)}" alt=""><span class="ph-glyph" style="display:none">◆</span></span>`
        : `<span class="artifact-perk" title="${esc(p.name)}" aria-label="${esc(p.name)}">◆</span>`).join('');
    }
  }

  const artifactConfiguration=currentMode==='live'
    ?liveArtifact?.artifactConfiguration||null
    :{schemaVersion:1,artifactHash:Number.isFinite(hashOf(id))?hashOf(id):null,seasonNumber:Number.isFinite(Number(artifactDef?.seasonNumber))?Number(artifactDef.seasonNumber):null,selectedPerkHashes:selected.slice(),source:'fixture-intent',provenance:{provider:'paradox-fixture',fixtureId:currentFixtureId,manifest:'beta-bungie-manifest-cache'}};
  document.dispatchEvent(new CustomEvent('astrix:artifact-selection-changed',{detail:{artifact:id,perks,currentFixtureId,artifactConfiguration,state:currentArtifactState,source:currentMode==='live'?'bungie-live-artifact':'paradox-artifact'}}));
}

function closePicker(){qs('#astrixArtifactModal')?.remove();}
function openPicker(){
  if(currentMode==='live')return;
  const tiers=tierList();
  if(!tiers.length)return;
  const id=artifactIdentity();
  const draft=selected.slice();
  const tiersHtml=tiers.map(t=>`<section class="beta-artifact-tier"><h3>TIER ${t.tier}</h3><div class="beta-artifact-grid">${t.perks.map(p=>`<button type="button" class="beta-artifact-choice ${draft.includes(p.hash)?'selected':''} ${p.unresolved?'unresolved':''}" data-perk-hash="${p.hash}" title="${esc([p.name,p.description].filter(Boolean).join(' — '))}"><span class="beta-artifact-icon">${p.icon?`<img src="${esc(p.icon)}" alt="">`:'◆'}</span><b>${esc(p.name)}</b></button>`).join('')}</div></section>`).join('');
  const wrap=document.createElement('div');
  wrap.id='astrixArtifactModal';wrap.className='beta-modal-backdrop';
  wrap.innerHTML=`<section class="beta-modal beta-artifact-modal" role="dialog" aria-modal="true"><header><div><small>GUARDIAN BUILD FORGE BETA</small><h2>${esc(id?.name||'Seasonal Artifact')}</h2></div><button type="button" data-close>✕</button></header><div class="beta-modal-body"><p class="beta-note">Fixture/DIM builds can supply Artifact selections here. Live Bungie Guardians are read-only and always use Bungie's active state.</p><div class="beta-artifact-summary"><b>${esc(id?.name||'Seasonal Artifact')}</b><span id="artifactCount">${draft.length}/${MAX_PERKS} selected</span></div><div class="beta-artifact-tiers">${tiersHtml}</div></div><footer><button type="button" class="beta-menu-item" data-artifact-clear>CLEAR</button><button type="button" class="beta-primary" data-artifact-apply>APPLY ARTIFACT</button></footer></section>`;
  closePicker();document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close]'))closePicker();});
  qsa('[data-perk-hash]',wrap).forEach(btn=>btn.addEventListener('click',()=>{const hash=Number(btn.dataset.perkHash);const at=draft.indexOf(hash);if(at>=0){draft.splice(at,1);btn.classList.remove('selected');}else if(draft.length<MAX_PERKS){draft.push(hash);btn.classList.add('selected');}const c=qs('#artifactCount',wrap);if(c)c.textContent=`${draft.length}/${MAX_PERKS} selected`;}));
  qs('[data-artifact-clear]',wrap)?.addEventListener('click',()=>{draft.length=0;qsa('.beta-artifact-choice',wrap).forEach(b=>b.classList.remove('selected'));const c=qs('#artifactCount',wrap);if(c)c.textContent=`0/${MAX_PERKS} selected`;});
  qs('[data-artifact-apply]',wrap)?.addEventListener('click',()=>{selected=draft.slice();saveOverride(currentFixtureId,selected);renderArtifactDisplay();closePicker();});
}

function wireRow(){
  const row=qs('.artifact-row');if(!row||row.dataset.artifactWired)return;
  row.dataset.artifactWired='1';row.tabIndex=0;row.setAttribute('role','button');
  row.addEventListener('click',openPicker);
  row.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&currentMode!=='live'){e.preventDefault();openPicker();}});
}

function installStyles(){
  if(qs('#astrixArtifactStyles'))return;
  const style=document.createElement('style');style.id='astrixArtifactStyles';style.textContent=`
    .artifact-row[data-artifact-mode="fixture"]{cursor:pointer}
    .artifact-row:focus-visible{outline:1px solid #9e60ff;outline-offset:4px;border-radius:8px}
    #artPerks .art-empty{padding:5px 9px;border:1px dashed rgba(158,96,255,.5);border-radius:7px;background:transparent;color:#9e60ff;font:600 10px Rajdhani;letter-spacing:.04em;cursor:pointer}
    .beta-artifact-modal{width:min(980px,95vw)!important}.beta-artifact-summary{display:flex;justify-content:space-between;align-items:center;margin:4px 0 16px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:8px}.beta-artifact-summary span{color:#9e60ff}.beta-artifact-tiers{display:grid;gap:12px}.beta-artifact-tier{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:10px}.beta-artifact-tier h3{margin:0 0 8px;color:#a87aff;font:700 10px Orbitron;letter-spacing:.1em}.beta-artifact-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.beta-artifact-choice{display:grid;gap:5px;justify-items:center;min-width:0;padding:7px 4px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.02);color:#ddd;cursor:pointer}.beta-artifact-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:7px;background:#16111f}.beta-artifact-icon img{width:100%;height:100%;object-fit:contain}.beta-artifact-choice b{max-width:100%;font:600 8px Rajdhani;line-height:1.05;text-align:center}.beta-artifact-choice.selected{border-color:#33d6c7;background:rgba(51,214,199,.06)}.beta-artifact-choice.unresolved{opacity:.6}@media(max-width:900px){.beta-artifact-grid{grid-template-columns:repeat(4,1fr)}}`;
  document.head.appendChild(style);
}

async function onSelection(detail={}){
  const liveMode=['bungie-live','bungie-loadout','bungie-selected-loadout'].includes(String(detail?.source||'').toLowerCase());
  if(liveMode){
    const view=resolveArtifactViewState(detail,{});
    currentMode='live';currentArtifactState=view.state;currentFixtureId=null;liveArtifact=view.artifact;selected=Array.isArray(view.selectedHashes)?view.selectedHashes:[];
    livePerksByHash=new Map([...(view.allPerks||[]),...(view.perks||[])].map(item=>[Number(item.hash),item]));
    renderArtifactDisplay();wireRow();return;
  }

  try{await ensureManifest();}catch(err){console.error('[Paradox artifact]',err);return;}
  currentMode='fixture';currentArtifactState='intended';liveArtifact=null;livePerksByHash=new Map();currentFixtureId=detail?.fixtureId??currentFixtureId;
  const view=resolveArtifactViewState(detail,{fixtureArtifact:fixtureArtifactIdentity(),fixtureSelected:selectionForFixture(detail)});
  selected=view.selectedHashes;renderArtifactDisplay();wireRow();
}

document.addEventListener('astrix:guardian-selection-changed',e=>onSelection(e.detail||{}));
document.addEventListener('astrix:bungie-loadout-loaded',e=>onSelection({...e.detail,source:'bungie-loadout'}));
document.addEventListener('astrix:beta-fixture-loaded',e=>onSelection(e.detail||{}));

(async()=>{installStyles();wireRow();try{await ensureManifest();if(currentMode!=='live')renderArtifactDisplay();}catch(err){console.error('[Paradox artifact]',err);}})();
