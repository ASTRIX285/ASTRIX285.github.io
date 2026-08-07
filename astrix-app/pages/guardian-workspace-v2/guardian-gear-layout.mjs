const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const armourNames=['Helmet','Gauntlets','Chest','Legs','Class Item'];
function loadCss(){if(document.querySelector('link[href="./guardian-gear-layout.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./guardian-gear-layout.css';document.head.appendChild(l)}
function modTile(mod){const name=mod?.name??mod?.displayName??'Loaded armour mod';const icon=mod?.icon??mod?.iconUrl??mod?.displayProperties?.icon??'';const cost=mod?.energyCost??mod?.cost??'';return `<button class="gear-mod" type="button" title="${esc(name)}" aria-label="${esc(name)}" ${cost!==''?`data-cost="${esc(cost)}"`:''}>${icon?`<img src="${esc(icon)}" alt="">`:'<span class="ph-glyph">◆</span>'}</button>`}
function armourCard(index,item){const name=item?.name??armourNames[index];const icon=item?.icon??item?.iconUrl??item?.displayProperties?.icon??'';const isExotic=String(item?.tier??item?.rarity??'').toLowerCase().includes('exotic')||item?.isExotic===true;const mods=Array.isArray(item?.mods)?item.mods:[];const modCount=Math.max(3,mods.length);return `<article class="gear-slot ${isExotic?'exotic':''}" data-armour-index="${index}"><div class="gear-slot-label">${esc(name)}</div><div class="gear-arm-anchor"><div class="arm ph" tabindex="0" role="button" title="${esc(name)}"><span class="lv">${esc(item?.power??'—')}</span>${icon?`<img src="${esc(icon)}" alt="">`:'<span class="ph-glyph">◇</span>'}</div></div><div class="gear-slot-divider"></div><div class="gear-mods">${Array.from({length:modCount},(_,i)=>modTile(mods[i])).join('')}</div></article>`}
function buildGear(armour=[]){const gear=document.querySelector('.gear-combined');if(!gear)return;gear.querySelector('.gear-columns').innerHTML=Array.from({length:5},(_,i)=>armourCard(i,armour[i])).join('')}
function initialise(){loadCss();const equip=document.querySelector('.equip');const left=document.querySelector('.left');if(!equip||!left)return;const cards=[...equip.children];const weapons=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='WEAPONS');const armour=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='ARMOUR');const stats=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='STATS');const mods=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='MODS');const activity=cards.find(c=>c.classList.contains('activity'));
  if(activity&&!left.contains(activity))left.appendChild(activity);
  if(stats&&!document.querySelector('.stage .eq')){stats.classList.add('stage-stats');document.querySelector('.stage')?.appendChild(stats)}
  if(weapons)weapons.classList.add('gear-weapons');
  if(armour)armour.remove();if(mods)mods.remove();
  if(!equip.querySelector('.gear-combined'))equip.insertAdjacentHTML('beforeend',`<section class="eq gear-combined"><div class="eq-head"><h3>ARMOUR & MODS</h3><span class="tools">EQUIPPED</span></div><div class="gear-subhead"><span>Armour above · socketed mods below</span><span>Hover any item for details</span></div><div class="gear-columns"></div></section>`);
  equip.classList.add('gear-layout-active');
  buildGear([]);
}
document.addEventListener('astrix:guardian-selection-changed',e=>{if(Array.isArray(e.detail?.armour))buildGear(e.detail.armour)});
initialise();
