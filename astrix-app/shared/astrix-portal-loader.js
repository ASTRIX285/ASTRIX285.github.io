/* =====================================================================
   ASTRIX PARADOX — GLOBAL PORTAL LOADER controller
   Include on every page AFTER astrix-portal-loader.css.
   API:
     AstrixLoader.mount()        // shows the portal as soon as <body> exists
     AstrixLoader.set(pct)       // 0..100, updates ring + %
     AstrixLoader.status(text)   // optional status line
     AstrixLoader.done()         // fade out — call when the page is RENDERED
   Set the logo path once:  window.APX_LOGO = '/img/logo.png';
   ===================================================================== */
(function(){
  document.documentElement.classList.add('apx-booting');
  var LOGO = (window.APX_LOGO || '/img/logo.png');
  var gate, prog, pct, status, pendingPct=0, pendingStatus='Opening portal', pendingDone=false;
  function markup(){
    return ''+
    '<div class="apx-gate" role="status" aria-live="polite" aria-label="Loading">'+
      '<div class="apx-stage">'+
        '<div class="apx-pct">0%</div>'+
        '<div class="apx-portal">'+
          '<div class="apx-aura"></div>'+
          '<div class="apx-tunnel"><i></i><i></i><i></i><i></i><i></i></div>'+
          '<div class="apx-ring a"></div>'+
          '<div class="apx-ring b"></div>'+
          '<div class="apx-prog"></div>'+
          '<div class="apx-core"></div>'+
          '<div class="apx-brandcore">'+
            '<div class="apx-pulse"></div>'+
            '<div class="apx-pulse-ring"></div>'+
            '<div class="apx-pulse-ring two"></div>'+
            '<img class="apx-logo" src="'+LOGO+'" alt="">'+
          '</div>'+
        '</div>'+
        '<div class="apx-brand">ASTRIX <em>PARADOX</em></div>'+
        '<p class="apx-status">Opening portal</p>'+
      '</div>'+
    '</div>';
  }
  function cache(){
    gate=document.querySelector('.apx-gate');
    if(!gate)return;
    prog=gate.querySelector('.apx-prog');pct=gate.querySelector('.apx-pct');status=gate.querySelector('.apx-status');
  }
  function apply(){
    if(prog)prog.style.setProperty('--p',pendingPct);
    if(pct)pct.textContent=pendingPct+'%';
    if(status)status.textContent=pendingStatus;
    if(pendingDone)finish();
  }
  function mount(){
    if(document.querySelector('.apx-gate')){
      cache();apply();document.documentElement.classList.remove('apx-booting');return;
    }
    if(!document.body)return;
    var wrap=document.createElement('div');wrap.innerHTML=markup();
    gate=wrap.firstElementChild;document.body.appendChild(gate);
    document.body.classList.add('apx-loading');cache();apply();
    document.documentElement.classList.remove('apx-booting');
  }
  function set(v){
    v=Math.max(0,Math.min(100,Math.round(Number(v)||0)));
    pendingPct=Math.max(pendingPct,v);
    if(prog)prog.style.setProperty('--p',pendingPct);
    if(pct)pct.textContent=pendingPct+'%';
  }
  function setStatus(t){
    pendingStatus=String(t||'Opening portal');
    if(status)status.textContent=pendingStatus;
  }
  function finish(){
    if(!gate||gate.classList.contains('is-done'))return;
    pendingPct=100;
    if(prog)prog.style.setProperty('--p',100);
    if(pct)pct.textContent='100%';
    gate.classList.add('is-done');document.body.classList.remove('apx-loading');
    var removeGate=function(event){
      if(event.target!==gate)return;
      gate.removeEventListener('transitionend',removeGate);
      if(gate&&gate.parentNode)gate.remove();
    };
    gate.addEventListener('transitionend',removeGate);
  }
  function done(){pendingDone=true;set(100);if(gate)finish();}
  if(document.body)mount();
  else{
    var bodyObserver=new MutationObserver(function(){
      if(!document.body)return;
      bodyObserver.disconnect();mount();
    });
    bodyObserver.observe(document.documentElement,{childList:true});
    document.addEventListener('DOMContentLoaded',function(){bodyObserver.disconnect();mount();},{once:true});
  }
  window.AstrixLoader={mount:mount,set:set,status:setStatus,done:done};
})();
