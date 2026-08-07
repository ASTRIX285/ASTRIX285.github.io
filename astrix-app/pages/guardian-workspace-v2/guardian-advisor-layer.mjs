const SUBCLASS_NAMES={hunter:{void:'Nightstalker',solar:'Gunslinger',arc:'Arcstrider',stasis:'Revenant',strand:'Threadrunner',prismatic:'Prismatic Hunter'},titan:{void:'Sentinel',solar:'Sunbreaker',arc:'Striker',stasis:'Behemoth',strand:'Berserker',prismatic:'Prismatic Titan'},warlock:{void:'Voidwalker',solar:'Dawnblade',arc:'Stormcaller',stasis:'Shadebinder',strand:'Broodweaver',prismatic:'Prismatic Warlock'}};
const state={characterClass:'hunter',subclass:'void',artifact:null,recommendedArtifactPerks:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const item=v=>!v?null:typeof v==='string'?{name:v,icon:''}:{...v,name:v.name??v.displayName??v.label??'',icon:v.icon??v.iconUrl??v.displayProperties?.icon??''};
const list=v=>Array.isArray(v)?v.map(item).filter(Boolean):[];
function tile(v,superTile=false){const x=item(v);if(!x)return'';return `<span class="ico-badge ${superTile?'super':''}" tabindex="0" title="${esc(x.name||'Loaded item')}" aria-label="${esc(x.name||'Loaded item')}">${x.icon?`<img src="${esc(x.icon)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`:''}<span class="ph-glyph" style="${x.icon?'display:none':''}">◆</span></span>`}
function abilityList(data){if(Array.isArray(data.abilities))return list(data.abilities);const a=data.abilities&&typeof data.abilities==='object'?data.abilities:{};return [data.super??a.super,data.classAbility??a.classAbility??a.class,data.movement??a.movement,data.melee??a.melee,data.grenade??a.grenade].map(item).filter(Boolean)}
function render(data={}){
  Object.assign(state,data);
  const cls=String(data.characterClass??data.className??state.characterClass).toLowerCase();
  const sub=String(data.subclass??state.subclass).toLowerCase();
  state.characterClass=cls;state.subclass=sub;
  const subclassName=data.subclassName??data.subclassDisplayName??SUBCLASS_NAMES[cls]?.[sub]??`${sub} ${cls}`;
  const hero=document.querySelector('.subclass-hero');if(hero){const b=hero.querySelector('b');if(b)b.textContent=subclassName.toUpperCase();hero.dataset.subtitle=`${cls.toUpperCase()} SUBCLASS`}
  const crest=document.getElementById('scCrest');const crestUrl=data.subclassIcon??data.crest??data.subclassCrest;if(crest&&crestUrl){crest.style.display='';crest.src=crestUrl;crest.alt=`${subclassName} subclass icon`}
  const abilities=abilityList(data);if(abilities.length)document.getElementById('abilityList').innerHTML=abilities.map((x,i)=>`<div class="ability-row">${tile(x,i===0)}</div>`).join('');
  if(Array.isArray(data.aspects))document.getElementById('aspectList').innerHTML=list(data.aspects).map(x=>`<div class="slot">${tile(x)}</div>`).join('');
  if(Array.isArray(data.fragments))document.getElementById('fragList').innerHTML=list(data.fragments).map(x=>`<div class="slot">${tile(x)}</div>`).join('');
  const artifact=item(data.artifact??state.artifact);if(artifact){state.artifact=artifact;const n=document.getElementById('artName'),im=document.getElementById('artIcon');if(n)n.textContent=artifact.name||'Loaded Artifact';if(im){im.src=artifact.icon||'';im.alt=artifact.name||'Loaded Artifact'}}
  const recSource=data.recommendedArtifactPerks??data.artifactRecommendations??data.recommendedArtifactMods??state.recommendedArtifactPerks;
  if(Array.isArray(recSource)){state.recommendedArtifactPerks=recSource;const p=document.getElementById('artPerks');if(p)p.innerHTML=list(recSource).map(x=>x.icon?`<img src="${esc(x.icon)}" alt="" tabindex="0" title="${esc(x.name||'Recommended artifact perk')}" aria-label="${esc(x.name||'Recommended artifact perk')}" onerror="this.style.display='none'">`:tile(x)).join('')}
  const sw=document.querySelector('.char-switch b');if(sw)sw.textContent=`${cls.charAt(0).toUpperCase()+cls.slice(1)} ▾`;
}
document.addEventListener('astrix:guardian-selection-changed',e=>render(e.detail||{}));
document.addEventListener('astrix:artifact-recommendations-changed',e=>render(e.detail||{}));
render({characterClass:'hunter',subclass:'void'});
