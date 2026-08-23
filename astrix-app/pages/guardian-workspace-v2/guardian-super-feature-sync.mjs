/* ASTRIX PARADOX — resolved subclass / Super presentation bridge.
 * Subclass positions stay fixed. Bungie data only supplies artwork + active state.
 * Super chain is populated directly from event.detail.subclassBuild.
 */

import { cleanImageElement } from './guardian-bungie-icon-cleaner.mjs';
import './guardian-artifact.mjs';
import './paradox-build-space-handoff.mjs';

if (!document.querySelector('link[data-astrix-subclass-super-polish]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './guardian-subclass-super-polish.css?v=20260823-main-pass';
  link.dataset.astrixSubclassSuperPolish = 'true';
  document.head.appendChild(link);
}

if (!document.querySelector('link[data-astrix-left-panel-lock]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './guardian-left-panel-lock.css?v=20260823-main-pass-2';
  link.dataset.astrixLeftPanelLock = 'true';
  document.head.appendChild(link);
}

const slotObservers = new Map();
const subclassIconCache = new Map();
const LEFT_PANEL_SLOT_TARGETS = Object.freeze({ abilityList:4, aspectList:2, fragList:5, artPerks:7 });
const SUBCLASS_KEYS = Object.freeze(['arc','solar','void','stasis','strand','prismatic']);
const SUBCLASS_CACHE_KEY = 'astrix:bungie-subclass-icons-v1';

function loadSubclassIconCache() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SUBCLASS_CACHE_KEY) || '{}');
    Object.entries(saved).forEach(([key, value]) => {
      if (typeof value === 'string' && value) subclassIconCache.set(key, value);
    });
  } catch {}
}
function persistSubclassIconCache() { try { sessionStorage.setItem(SUBCLASS_CACHE_KEY, JSON.stringify(Object.fromEntries(subclassIconCache))); } catch {} }
loadSubclassIconCache();
function makeEmptyRailSlot(){const slot=document.createElement('span');slot.className='rail-empty-slot';slot.setAttribute('aria-hidden','true');return slot;}
function enforceSlotCount(id,target){const host=document.getElementById(id);if(!host)return;while(host.children.length<target)host.appendChild(makeEmptyRailSlot());}
function enforceLeftPanelSlots(){Object.entries(LEFT_PANEL_SLOT_TARGETS).forEach(([id,target])=>{enforceSlotCount(id,target);const host=document.getElementById(id);if(!host||slotObservers.has(id))return;const observer=new MutationObserver(()=>enforceSlotCount(id,target));observer.observe(host,{childList:true});slotObservers.set(id,observer);});}
function resolvedDisplayIcon(item){if(!item)return '';const display=item?.definition?.displayProperties||item?.displayProperties||{};const sequenceFrame=Array.isArray(display?.iconSequences)?display.iconSequences.flatMap(sequence=>Array.isArray(sequence?.frames)?sequence.frames:[]).find(Boolean):'';return item.icon||display.icon||display.highResIcon||sequenceFrame||item?.definition?.secondaryIcon||item?.secondaryIcon||'';}
function bungieUrl(path){if(!path)return '';return path.startsWith('http')?path:`https://www.bungie.net${path}`;}
function subclassCacheId(characterClass,element){return `${String(characterClass||'unknown').toLowerCase()}:${String(element||'').toLowerCase()}`;}
function cacheSubclassIcon(characterClass,element,icon){const src=bungieUrl(icon);if(!src||!SUBCLASS_KEYS.includes(element))return;subclassIconCache.set(subclassCacheId(characterClass,element),src);persistSubclassIconCache();}
function ingestSubclassCatalog(detail={}){const characterClass=String(detail.characterClass||'').toLowerCase();const catalog=Array.isArray(detail.subclassCatalog)?detail.subclassCatalog:[];catalog.forEach(item=>{const element=String(item?.element||item?.subclass||'').toLowerCase();cacheSubclassIcon(characterClass,element,resolvedDisplayIcon(item));});const activeElement=String(detail.subclass||'').trim().toLowerCase();if(activeElement&&detail.subclassIcon)cacheSubclassIcon(characterClass,activeElement,detail.subclassIcon);}
function setSubclassDiamondIcon(button,src,element){const holder=button?.querySelector('.subclass-option__diamond>span');if(!holder)return;if(!src){if(!holder.querySelector('img'))holder.textContent=element.slice(0,2).toUpperCase();button.classList.remove('has-bungie-subclass-icon');return;}let img=holder.querySelector('img.subclass-option__icon');if(!img){holder.textContent='';img=document.createElement('img');img.className='subclass-option__icon';holder.appendChild(img);}img.alt=`${element} subclass`;img.src=src;button.classList.add('has-bungie-subclass-icon');}
function syncSubclassRail(detail={}){ingestSubclassCatalog(detail);const activeElement=String(detail.subclass||'').trim().toLowerCase();const characterClass=String(detail.characterClass||'').toLowerCase();document.querySelectorAll('[data-subclass-option]').forEach(button=>{const key=String(button.dataset.subclassOption||'').trim().toLowerCase();const active=Boolean(activeElement)&&key===activeElement;const cached=subclassIconCache.get(subclassCacheId(characterClass,key))||'';setSubclassDiamondIcon(button,cached,key);button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});}
function setDiamondFromItem(diamond,item,fallbackTitle=''){if(!diamond)return;const holder=diamond.querySelector('span');if(!holder)return;const icon=resolvedDisplayIcon(item);const title=String(item?.name||fallbackTitle||'').trim();const src=bungieUrl(icon);if(src){let img=holder.querySelector('img.super-feature__icon');if(!img){holder.textContent='';img=document.createElement('img');img.className='super-feature__icon';holder.appendChild(img);}img.alt=title;diamond.classList.add('has-live-icon');void cleanImageElement(img,src);}else{holder.textContent='◆';diamond.classList.remove('has-live-icon');}diamond.title=title||fallbackTitle;diamond.setAttribute('aria-label',title||fallbackTitle);}
function canonicalElement(value){const key=String(value||'').trim().toLowerCase();return SUBCLASS_KEYS.includes(key)&&key!=='prismatic'?key:'';}
function verifiedSuperElement(option,detail={}){const direct=[option?.element,option?.subclass,option?.damageType,option?.elementDefinition?.displayProperties?.name,option?.definition?.damageType].map(canonicalElement).find(Boolean);if(direct)return direct;const hash=Number(option?.hash);const catalog=Array.isArray(detail.subclassCatalog)?detail.subclassCatalog:[];for(const row of catalog){const candidates=[...(Array.isArray(row?.superOptions)?row.superOptions:[]),...(Array.isArray(row?.subclassBuild?.superOptions)?row.subclassBuild.superOptions:[])];if(candidates.some(candidate=>Number(candidate?.hash??candidate)===hash)){const element=canonicalElement(row?.element||row?.subclass);if(element)return element;}}return '';}
function ensurePrismaticSatellite(host,index){let slot=host.querySelector(`[data-prismatic-super-slot="${index}"]`);if(slot)return slot;slot=document.createElement('div');slot.className=`super-diamond super-diamond--prismatic-satellite super-diamond--prismatic-${index+1}`;slot.dataset.prismaticSuperSlot=String(index);slot.innerHTML='<span>◆</span>';host.appendChild(slot);return slot;}
function syncTranscendence(host,detail,isPrismatic){let block=host.parentElement?.querySelector('.prismatic-transcendence');const build=detail?.subclassBuild||{};const explicit=Array.isArray(build.transcendenceOptions)?build.transcendenceOptions.filter(Boolean):[];const derived=(Array.isArray(build.abilities)?build.abilities:[]).filter(item=>String(item?.definition?.plug?.plugCategoryIdentifier||item?.plugCategoryIdentifier||'').toLowerCase().includes('transcend'));const options=[...explicit,...derived].filter((item,index,rows)=>item&&rows.findIndex(other=>Number(other?.hash)===Number(item?.hash))===index).slice(0,2);if(!isPrismatic||!options.length){block?.remove();return;}if(!block){block=document.createElement('section');block.className='prismatic-transcendence';block.innerHTML='<span class="prismatic-transcendence__label">TRANSCENDENCE</span><div class="prismatic-transcendence__slots"></div>';host.parentElement?.insertBefore(block,host);}const slots=block.querySelector('.prismatic-transcendence__slots');slots.replaceChildren();options.forEach((item,index)=>{const slot=document.createElement('button');slot.type='button';slot.className='prismatic-transcendence__slot';slot.dataset.transcendenceHash=String(item.hash||'');slot.setAttribute('aria-pressed',String(Boolean(item?.equipped||item?.isEquipped)));slot.classList.toggle('is-equipped',Boolean(item?.equipped||item?.isEquipped));slot.innerHTML='<span>◆</span>';slots.appendChild(slot);setDiamondFromItem(slot,item,`Transcendence option ${index+1}`);});}
function populateSuperChain(detail={}){const host=document.getElementById('superFeatureCluster');const build=detail?.subclassBuild||{};if(!host||!build)return;const active=build.super||null;const options=Array.isArray(build.superOptions)?build.superOptions.filter(Boolean):[];const activeHash=Number(active?.hash);const alternates=options.filter(option=>Number(option?.hash)!==activeHash);const isPrismatic=String(detail.subclass||'').trim().toLowerCase()==='prismatic';host.classList.toggle('is-prismatic',isPrismatic);const equipped=host.querySelector('[data-super-slot="equipped"]');setDiamondFromItem(equipped,active,'Equipped Super');host.querySelectorAll('[data-super-slot^="alternate-"]').forEach(slot=>slot.hidden=isPrismatic);host.querySelectorAll('[data-prismatic-super-slot]').forEach(slot=>slot.remove());if(isPrismatic){const verified=[];for(const option of alternates){const element=verifiedSuperElement(option,detail);if(!element||verified.some(row=>row.element===element))continue;verified.push({option,element});if(verified.length===5)break;}verified.forEach(({option,element},index)=>{const slot=ensurePrismaticSatellite(host,index);slot.dataset.element=element;slot.style.setProperty('--satellite-colour',`var(--element-${element})`);setDiamondFromItem(slot,option,`${element} Super`);});}else{const standard=alternates.slice(0,2);const alt1=host.querySelector('[data-super-slot="alternate-1"]');const alt2=host.querySelector('[data-super-slot="alternate-2"]');const bottom=host.querySelector('[data-super-slot="alternate-3"]');setDiamondFromItem(alt1,standard[0]||null,'Alternate Super');setDiamondFromItem(alt2,standard[1]||null,'Alternate Super');setDiamondFromItem(bottom,active,'Selected Super');host.querySelectorAll('.super-diamond--alt').forEach(slot=>{const selected=slot===bottom;slot.classList.toggle('is-selected-super',selected);slot.setAttribute('aria-selected',String(selected));if(selected)slot.setAttribute('aria-current','true');else slot.removeAttribute('aria-current');});}syncTranscendence(host,detail,isPrismatic);const label=document.getElementById('subclassName');if(label&&active?.name){label.textContent=active.name;label.dataset.superName=active.name;}}
document.addEventListener('astrix:guardian-selection-changed',event=>{const detail=event.detail||{};syncSubclassRail(detail);enforceLeftPanelSlots();queueMicrotask(()=>populateSuperChain(detail));});
document.addEventListener('astrix:artifact-recommendations-changed',enforceLeftPanelSlots);
enforceLeftPanelSlots();
