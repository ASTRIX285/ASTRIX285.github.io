const HERO_BY_CLASS={
  hunter:'./Hunter-hero-transparent.png',
  titan:'./titan-hero-transparent.png',
  warlock:'./Warlock-hero-transparent.png'
};

const CLASS_ORDER=['hunter','titan','warlock'];
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
let activeClass='hunter';
let fixtures=[];

function esc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function installStyles(){
  if(qs('#astrix-class-selector-style'))return;
  const style=document.createElement('style');
  style.id='astrix-class-selector-style';
  style.textContent=`
    .stage[data-class="hunter"]{--class-hero-footline:6.7%;--class-hero-height:82%}
    .stage[data-class="titan"]{--class-hero-footline:6.5%;--class-hero-height:82%}
    .stage[data-class="warlock"]{--class-hero-footline:11.5%;--class-hero-height:84%}
    .stage[data-class] .guardian-hero{bottom:var(--class-hero-footline,var(--guardian-footline))!important;height:var(--class-hero-height,var(--guardian-max-h))!important}
    .stage[data-class="warlock"] .guardian-hero img{filter:drop-shadow(0 26px 46px rgba(0,0,0,.72)) drop-shadow(0 0 42px rgba(139,92,246,.38))}
    .char-switch{cursor:pointer!important}
    .pf-class-picker-backdrop{position:fixed;inset:0;z-index:420;display:grid;place-items:center;padding:24px;background:rgba(2,2,8,.78);backdrop-filter:blur(8px)}
    .pf-class-picker{width:min(820px,94vw);max-height:82vh;overflow:auto;border:1px solid rgba(158,96,255,.36);border-radius:16px;background:linear-gradient(180deg,#171022,#09070f);box-shadow:0 30px 90px #000;color:#fff}
    .pf-class-picker header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .pf-class-picker header small{font:600 9px Orbitron;letter-spacing:.16em;color:#9e60ff}.pf-class-picker h2{margin:4px 0 0;font:700 18px Orbitron;letter-spacing:.08em}.pf-class-picker header button{width:36px;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#aaa;background:transparent}
    .pf-class-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px 20px 0}.pf-class-tab{padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.025);color:#bbb;font:700 11px Orbitron;letter-spacing:.08em}.pf-class-tab.active{border-color:#9e60ff;background:rgba(158,96,255,.16);color:#fff}
    .pf-class-loadouts{display:grid;gap:8px;padding:16px 20px 20px}.pf-class-loadout{display:grid;grid-template-columns:1fr auto;gap:4px 14px;padding:11px 12px;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.02);color:#fff}.pf-class-loadout b{font:700 12px Orbitron}.pf-class-loadout span{color:#aaa}.pf-class-loadout small{grid-column:2;grid-row:1/3;align-self:center;color:#7956b8}.pf-class-loadout:hover,.pf-class-loadout.active{border-color:#9e60ff;background:rgba(158,96,255,.1)}
    .pf-class-empty{padding:22px;color:#aaa;text-align:center}
  `;
  document.head.appendChild(style);
}

function className(v){
  const x=String(v??'').trim().toLowerCase();
  return CLASS_ORDER.includes(x)?x:'hunter';
}

function applyHero(detail={}){
  const cls=className(detail.characterClass??detail.className??activeClass);
  activeClass=cls;
  const stage=qs('.stage');
  const image=qs('#guardianRender');
  if(stage)stage.dataset.class=cls;
  if(image){
    const src=HERO_BY_CLASS[cls];
    if(src&&image.getAttribute('src')!==src){
      image.style.display='block';
      image.src=src;
    }
    image.alt=`${cls.charAt(0).toUpperCase()+cls.slice(1)} Guardian beta render`;
  }
  const label=qs('.char-switch b');
  if(label)label.textContent=`${cls.charAt(0).toUpperCase()+cls.slice(1)} ▾`;
}

function renderLoadouts(modal,cls){
  const host=qs('.pf-class-loadouts',modal);
  const list=fixtures.filter(f=>className(f.className)===cls);
  const current=globalThis.ASTRIXBetaFixtures?.current?.();
  if(!list.length){
    host.innerHTML='<div class="pf-class-empty">No beta loadouts are available for this class yet.</div>';
    return;
  }
  host.innerHTML=list.map(f=>`<button type="button" class="pf-class-loadout ${f.fixtureId===current?'active':''}" data-fixture="${esc(f.fixtureId)}"><b>${esc(f.displayName)}</b><span>${esc(f.subclassName)} · ${esc(f.element)}</span><small>${esc(f.fixtureId)}</small></button>`).join('');
  qsa('[data-fixture]',host).forEach(btn=>btn.addEventListener('click',async()=>{
    await globalThis.ASTRIXBetaFixtures.load(btn.dataset.fixture);
    modal.remove();
  }));
}

function openSelector(){
  qs('#astrixBetaFixtureSelect')?.remove();
  qs('.pf-class-picker-backdrop')?.remove();
  const wrap=document.createElement('div');
  wrap.className='pf-class-picker-backdrop';
  wrap.innerHTML=`<section class="pf-class-picker" role="dialog" aria-modal="true" aria-label="Choose Guardian class and beta loadout"><header><div><small>PARADOX FORGE BETA</small><h2>SELECT GUARDIAN</h2></div><button type="button" data-close aria-label="Close">✕</button></header><div class="pf-class-tabs">${CLASS_ORDER.map(cls=>`<button type="button" class="pf-class-tab ${cls===activeClass?'active':''}" data-class="${cls}">${cls.toUpperCase()}</button>`).join('')}</div><div class="pf-class-loadouts"></div></section>`;
  document.body.appendChild(wrap);
  renderLoadouts(wrap,activeClass);
  qsa('[data-class]',wrap).forEach(btn=>btn.addEventListener('click',()=>{
    qsa('[data-class]',wrap).forEach(x=>x.classList.toggle('active',x===btn));
    activeClass=btn.dataset.class;
    renderLoadouts(wrap,activeClass);
  }));
  wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close]'))wrap.remove()});
}

async function initialise(){
  installStyles();
  for(let i=0;i<60;i+=1){
    const api=globalThis.ASTRIXBetaFixtures;
    if(api?.list){
      fixtures=await api.list();
      break;
    }
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  qs('#astrixBetaFixtureSelect')?.remove();
  const switcher=qs('.char-switch');
  if(switcher){
    switcher.addEventListener('click',openSelector);
    switcher.setAttribute('role','button');
    switcher.setAttribute('tabindex','0');
    switcher.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();openSelector()}
    });
  }
}

document.addEventListener('astrix:guardian-selection-changed',e=>applyHero(e.detail||{}));
document.addEventListener('astrix:beta-fixture-loaded',e=>applyHero(e.detail||{}));
applyHero({characterClass:'hunter'});
initialise();
