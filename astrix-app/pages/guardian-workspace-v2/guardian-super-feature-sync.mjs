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
  link.href = './guardian-left-panel-lock.css?v=20260820-0004';
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
function populateSuperChain(detail={}){const host=document.getElementById('superFeatureCluster');const build=detail?.subclassBuild||{};if(!host||!build)return;const active=build.super||null;const options=Array.isArray(build.superOptions)?build.superOptions.filter(Boolean):[];const activeHash=Number(active?.hash);const alternates=options.filter(option=>Number(option?.hash)!==activeHash).slice(0,2);const equipped=host.querySelector('[data-super-slot="equipped"]');const alt1=host.querySelector('[data-super-slot="alternate-1"]');const alt2=host.querySelector('[data-super-slot="alternate-2"]');const bottom=host.querySelector('[data-super-slot="alternate-3"]');setDiamondFromItem(equipped,active,'Equipped Super');setDiamondFromItem(alt1,alternates[0]||null,'Alternate Super');setDiamondFromItem(alt2,alternates[1]||null,'Alternate Super');setDiamondFromItem(bottom,active,'Selected Super');host.querySelectorAll('.super-diamond--alt').forEach(slot=>{const selected=slot===bottom;slot.classList.toggle('is-selected-super',selected);slot.setAttribute('aria-selected',String(selected));if(selected)slot.setAttribute('aria-current','true');else slot.removeAttribute('aria-current');});const label=document.getElementById('subclassName');if(label&&active?.name){label.textContent=active.name;label.dataset.superName=active.name;}}
document.addEventListener('astrix:guardian-selection-changed',event=>{const detail=event.detail||{};syncSubclassRail(detail);enforceLeftPanelSlots();queueMicrotask(()=>populateSuperChain(detail));});
document.addEventListener('astrix:artifact-recommendations-changed',enforceLeftPanelSlots);
enforceLeftPanelSlots();
