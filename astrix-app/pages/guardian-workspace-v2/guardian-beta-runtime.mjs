import "./guardian-bungie-auth.mjs";

const qs=(s,r=document)=>r.querySelector(s);

function simpleModal(title,message){
  document.getElementById('astrixRuntimeModal')?.remove();
  const wrap=document.createElement('div');
  wrap.id='astrixRuntimeModal';
  wrap.className='beta-modal-backdrop';
  wrap.innerHTML=`<section class="beta-modal" role="dialog" aria-modal="true"><header><div><small>PARADOX FORGE BETA</small><h2>${title}</h2></div><button type="button" data-close>✕</button></header><div class="beta-modal-body"><p>${message}</p></div></section>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close]'))wrap.remove()});
}

function runtimeToast(message){
  let el=document.getElementById('astrixBetaToast');
  if(!el){
    el=document.createElement('div');
    el.id='astrixBetaToast';
    el.setAttribute('role','status');
    document.body.appendChild(el);
  }
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(runtimeToast.timer);
  runtimeToast.timer=setTimeout(()=>el.classList.remove('show'),2400);
}

async function loadFixtureFromUrl(){
  const id=new URL(location.href).searchParams.get('fixture');
  if(!id)return;
  for(let tries=0;tries<50;tries+=1){
    const api=globalThis.ASTRIXBetaFixtures;
    if(api?.load){
      try{await api.load(id)}catch(error){console.warn('[Paradox beta share link]',error)}
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}

function showSaved(){
  const ids=JSON.parse(localStorage.getItem('astrix-paradox-saved-loadouts')||'[]');
  if(!ids.length)return simpleModal('Saved Beta Loadouts','No beta loadouts have been saved in this browser yet.');
  const body=ids.map(id=>`<button type="button" class="beta-menu-item" data-saved-fixture="${id}">${id}</button>`).join(' ');
  const wrap=document.createElement('div');
  wrap.id='astrixRuntimeModal';
  wrap.className='beta-modal-backdrop';
  wrap.innerHTML=`<section class="beta-modal" role="dialog" aria-modal="true"><header><div><small>PARADOX FORGE BETA</small><h2>Saved Beta Loadouts</h2></div><button type="button" data-close>✕</button></header><div class="beta-modal-body">${body}</div></section>`;
  document.getElementById('astrixRuntimeModal')?.remove();
  document.body.appendChild(wrap);
  wrap.addEventListener('click',async e=>{
    if(e.target===wrap||e.target.closest('[data-close]'))return wrap.remove();
    const button=e.target.closest('[data-saved-fixture]');
    if(button&&globalThis.ASTRIXBetaFixtures?.load){
      await globalThis.ASTRIXBetaFixtures.load(button.dataset.savedFixture);
      wrap.remove();
      runtimeToast(`${button.dataset.savedFixture} loaded`);
    }
  });
}

function installDelegatedControls(){
  document.addEventListener('click',e=>{
    if(e.target.closest('#betaSaved')){
      document.getElementById('astrixBetaModal')?.remove();
      showSaved();
    }
    if(e.target.closest('#betaFeedback')){
      document.getElementById('astrixBetaModal')?.remove();
      simpleModal('Beta Feedback','Tester feedback should include the fixture ID, what you expected, what happened, and a screenshot where useful.');
    }
  });

  document.addEventListener('astrix:request-super-change',()=>{
    simpleModal('Change Super','Super editing is intentionally read-only in fixture beta mode. Live Bungie/DIM replication will provide editable build mutation later.');
  });

  qs('.gtag')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}
  });
  qs('.view3d')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}
  });
}

installDelegatedControls();
loadFixtureFromUrl();
