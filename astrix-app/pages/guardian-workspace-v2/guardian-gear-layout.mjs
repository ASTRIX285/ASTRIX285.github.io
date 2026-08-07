const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const armourNames=['Helmet','Gauntlets','Chest','Legs','Class Item'];

function loadCss(){
  if(!document.querySelector('link[href="./guardian-gear-layout.css"]')){
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='./guardian-gear-layout.css';
    document.head.appendChild(l);
  }

  if(!document.getElementById('pf-gear-layout-final')){
    const style=document.createElement('style');
    style.id='pf-gear-layout-final';
    style.textContent=`
      /* Final beta gear proportions */
      .equip.gear-layout-active{
        grid-template-columns:minmax(300px,320px) minmax(0,1fr)!important;
        gap:14px!important;
      }

      /* Weapon art should read at roughly the same visual scale as armour art. */
      .gear-weapons .weap-grid{
        grid-template-columns:repeat(3,92px)!important;
        gap:10px!important;
        justify-content:start!important;
      }
      .gear-weapons .weap{
        width:92px!important;
        min-width:92px!important;
      }
      .gear-weapons .weap .art{
        width:92px!important;
        height:92px!important;
        min-height:92px!important;
        aspect-ratio:1/1!important;
      }
      .gear-weapons .weap .cap{
        width:92px!important;
        padding-top:5px!important;
      }

      /* Preserve the armour-card footprint. */
      .gear-columns{
        gap:10px!important;
      }
      .gear-arm-row{
        min-height:94px!important;
      }
      .gear-arm-anchor .arm{
        width:88px!important;
        height:88px!important;
      }

      /* Only Exotic armour receives the extra intrinsic tile. Match Artifact icon scale. */
      .gear-slot:not(.exotic) .gear-intrinsic{
        display:none!important;
      }
      .gear-intrinsic{
        width:46px!important;
        height:46px!important;
        min-width:46px!important;
        min-height:46px!important;
        flex:0 0 46px!important;
      }

      /* Functional armour mod blocks match the 46px Artifact perk icons. */
      .gear-mods{
        grid-template-columns:repeat(3,46px)!important;
        grid-auto-rows:46px!important;
        gap:7px!important;
        justify-content:start!important;
        align-content:start!important;
      }
      .gear-mod{
        width:46px!important;
        height:46px!important;
        min-width:46px!important;
        min-height:46px!important;
        aspect-ratio:1/1!important;
      }
    `;
    document.head.appendChild(style);
  }
}

function modTile(mod){
  const name=mod?.name??mod?.displayName??'Empty mod slot';
  const icon=mod?.icon??mod?.iconUrl??mod?.displayProperties?.icon??'';
  const cost=mod?.energyCost??mod?.cost??'';
  return `<button class="gear-mod" type="button" title="${esc(name)}" aria-label="${esc(name)}" ${cost!==''?`data-cost="${esc(cost)}"`:''}>${icon?`<img src="${esc(icon)}" alt="">`:'<span class="ph-glyph">◆</span>'}</button>`;
}

function appearanceTile(item){
  if(!item)return '';
  const name=item?.name??item?.displayName??'Appearance plug';
  const description=item?.description??'';
  const hash=item?.bungieHash??item?.hash??'';
  const icon=item?.icon??item?.iconUrl??item?.displayProperties?.icon??'';
  const title=[name,description,hash?`Bungie hash: ${hash}`:''].filter(Boolean).join(' — ');
  return `<button class="gear-appearance" type="button" title="${esc(title)}" aria-label="${esc(name)}">${icon?`<img src="${esc(icon)}" alt="">`:'<span class="ph-glyph">◇</span>'}</button>`;
}

function traitTile(trait){
  if(!trait)return '';
  const name=trait?.name??'Exotic intrinsic trait';
  const description=trait?.description??'';
  const hash=trait?.bungieHash??trait?.hash??'';
  const icon=trait?.icon??'';
  const title=[name,description,hash?`Bungie hash: ${hash}`:''].filter(Boolean).join(' — ');
  return `<button class="gear-intrinsic" type="button" title="${esc(title)}" aria-label="${esc(name)}">${icon?`<img src="${esc(icon)}" alt="">`:'<span class="ph-glyph">✦</span>'}</button>`;
}

function armourCard(index,item){
  const name=item?.name??armourNames[index];
  const icon=item?.icon??item?.iconUrl??item?.displayProperties?.icon??'';
  const rarity=String(item?.rarity??item?.tier??'').toLowerCase();
  const isExotic=item?.isExotic===true||rarity.includes('exotic');
  const trait=isExotic?(item?.intrinsicTrait??null):null;
  const mods=Array.isArray(item?.mods)?item.mods:[];
  const appearance=Array.isArray(item?.appearancePlugs)?item.appearancePlugs:[];
  const slotCount=5;

  return `<article class="gear-slot ${isExotic?'exotic':''}" data-armour-index="${index}">
    <div class="gear-slot-label">${esc(name)}</div>
    <div class="gear-arm-row">
      <div class="gear-arm-anchor">
        <div class="arm ph" tabindex="0" role="button" title="${esc(name)}">
          <span class="lv">${esc(item?.power??'—')}</span>
          ${icon?`<img src="${esc(icon)}" alt="">`:'<span class="ph-glyph">◇</span>'}
        </div>
      </div>
      ${isExotic&&trait?traitTile(trait):''}
    </div>
    ${appearance.length?`<div class="gear-appearance-row">${appearance.slice(0,2).map(appearanceTile).join('')}</div>`:''}
    <div class="gear-slot-divider"></div>
    <div class="gear-mods" data-slot-count="${slotCount}">${Array.from({length:slotCount},(_,i)=>modTile(mods[i])).join('')}</div>
  </article>`;
}

function buildGear(armour=[]){
  const gear=document.querySelector('.gear-combined');
  if(!gear)return;
  gear.querySelector('.gear-columns').innerHTML=Array.from({length:5},(_,i)=>armourCard(i,armour[i])).join('');
}

function initialise(){
  loadCss();
  const equip=document.querySelector('.equip');
  const right=document.querySelector('.right');
  if(!equip||!right)return;
  const cards=[...equip.children];
  const weapons=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='WEAPONS');
  const armour=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='ARMOUR');
  const stats=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='STATS');
  const mods=cards.find(c=>c.querySelector('h3')?.textContent.trim()==='MODS');
  const activity=cards.find(c=>c.classList.contains('activity'))||document.querySelector('.left .activity');
  if(activity&&!right.contains(activity)){
    activity.classList.add('analysis-activity');
    const improvement=right.querySelector('.improve');
    if(improvement)right.insertBefore(activity,improvement);
    else right.appendChild(activity);
  }
  if(stats&&!document.querySelector('.stage .eq')){
    stats.classList.add('stage-stats');
    document.querySelector('.stage')?.appendChild(stats);
  }
  if(weapons)weapons.classList.add('gear-weapons');
  if(armour)armour.remove();
  if(mods)mods.remove();
  if(!equip.querySelector('.gear-combined')){
    equip.insertAdjacentHTML('beforeend',`<section class="eq gear-combined"><div class="eq-head"><h3>ARMOUR & MODS</h3><span class="tools">EQUIPPED</span></div><div class="gear-subhead"><span>Armour above · 5 functional mod slots below</span><span>Hover any sourced icon for Bungie details</span></div><div class="gear-columns"></div></section>`);
  }
  equip.classList.add('gear-layout-active');
  buildGear([]);
}

document.addEventListener('astrix:guardian-selection-changed',e=>{
  if(Array.isArray(e.detail?.armour))buildGear(e.detail.armour);
});

initialise();
