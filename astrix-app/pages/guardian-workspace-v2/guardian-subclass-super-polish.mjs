const STYLE_HREFS=["./guardian-subclass-super-polish.css?v=20260821-0842"];
STYLE_HREFS.forEach(href=>{
  if(document.querySelector(`link[href="${href}"]`))return;
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href=href;
  document.head.append(link);
});

const FINAL_STYLE_ID="guardian-subclass-super-runtime-authority";
const FINAL_STYLE=`
html body .workspace .left .subclass-super-shell{grid-template-columns:150px minmax(0,1fr)!important;gap:14px!important;align-items:start!important}
html body .workspace .left .subclass-rail{display:grid!important;grid-template-columns:repeat(2,52px)!important;grid-template-rows:auto repeat(3,52px)!important;column-gap:18px!important;row-gap:12px!important;width:140px!important;min-width:140px!important;justify-content:center!important;align-content:start!important}
html body .workspace .left .subclass-rail__label{grid-column:1/-1!important;margin:0 0 6px!important;text-align:center!important}
html body .workspace .left .subclass-option{width:52px!important;min-width:52px!important;height:52px!important;min-height:52px!important;margin:0!important;padding:0!important;transform:none!important}
html body .workspace .left .subclass-option__diamond{width:38px!important;height:38px!important;margin:0!important;transform:rotate(45deg)!important}

html body .workspace .left .super-feature{position:relative!important;min-height:405px!important;padding:0 0 42px!important;overflow:visible!important}
html body .workspace .left .super-feature__label{display:block!important;margin:0!important;text-align:center!important}
html body .workspace .left .super-feature__cluster{position:relative!important;width:280px!important;height:326px!important;margin:6px auto 0!important;overflow:visible!important}
html body .workspace .left .super-diamond--equipped{left:50%!important;top:6px!important;width:150px!important}
html body .workspace .left .super-diamond--alt{width:56px!important}
html body .workspace .left .super-diamond--alt1{left:calc(50% - 52px)!important;top:214px!important}
html body .workspace .left .super-diamond--alt2{left:calc(50% + 52px)!important;top:214px!important}
html body .workspace .left .super-diamond--alt3{left:50%!important;top:266px!important}
html body .workspace .left .super-feature::before,html body .workspace .left .super-feature::after{content:""!important;position:absolute!important;z-index:7!important;top:342px!important;height:1px!important;width:78px!important;background:linear-gradient(90deg,transparent,rgba(227,178,60,.72))!important;pointer-events:none!important}
html body .workspace .left .super-feature::before{left:calc(50% - 94px)!important}
html body .workspace .left .super-feature::after{right:calc(50% - 94px)!important;transform:scaleX(-1)!important}
html body .workspace .left .super-feature__name{display:block!important;position:absolute!important;z-index:9!important;top:359px!important;left:50%!important;width:240px!important;max-width:94%!important;transform:translateX(-50%)!important;margin:0!important;padding:0!important;color:rgba(255,255,255,.94)!important;font:800 .64rem/18px Inter,sans-serif!important;letter-spacing:.14em!important;text-align:center!important;text-transform:uppercase!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;pointer-events:none!important}
html body .workspace .left .super-feature__name::before{content:""!important;position:absolute!important;left:50%!important;top:-20px!important;width:8px!important;height:8px!important;transform:translateX(-50%) rotate(45deg)!important;border:1px solid rgba(227,178,60,.95)!important;background:#0b0910!important;box-shadow:0 0 8px rgba(227,178,60,.22)!important}

@media (max-width:860px){html body .workspace .left .subclass-super-shell{grid-template-columns:136px minmax(0,1fr)!important;gap:12px!important}html body .workspace .left .subclass-rail{grid-template-columns:repeat(2,48px)!important;grid-template-rows:auto repeat(3,48px)!important;column-gap:14px!important;row-gap:10px!important;width:126px!important;min-width:126px!important}html body .workspace .left .subclass-option{width:48px!important;min-width:48px!important;height:48px!important;min-height:48px!important}html body .workspace .left .subclass-option__diamond{width:35px!important;height:35px!important}html body .workspace .left .super-feature{min-height:390px!important}html body .workspace .left .super-feature__cluster{width:245px!important;height:314px!important}html body .workspace .left .super-diamond--equipped{width:138px!important;top:4px!important}html body .workspace .left .super-diamond--alt1{left:calc(50% - 45px)!important;top:196px!important}html body .workspace .left .super-diamond--alt2{left:calc(50% + 45px)!important;top:196px!important}html body .workspace .left .super-diamond--alt3{left:50%!important;top:240px!important}html body .workspace .left .super-feature::before,html body .workspace .left .super-feature::after{top:318px!important;width:64px!important}html body .workspace .left .super-feature::before{left:calc(50% - 79px)!important}html body .workspace .left .super-feature::after{right:calc(50% - 79px)!important}html body .workspace .left .super-feature__name{top:335px!important;font-size:.62rem!important}}
`;

function installFinalAuthorityStyle(){
  let style=document.getElementById(FINAL_STYLE_ID);
  if(!style){
    style=document.createElement("style");
    style.id=FINAL_STYLE_ID;
    document.head.append(style);
  }
  style.textContent=FINAL_STYLE;
}
installFinalAuthorityStyle();

const ICONS={
  arc:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 9.8 8.4 4 6l4.5 5.2L3 15l6.7.5L12 22l2.3-6.5L21 15l-5.5-3.8L20 6l-5.8 2.4Z"/></svg>',
  solar:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.8 3.1.2 4.8-1.2 6.2C9.2 10.8 8 12.1 8 14.4A4 4 0 0 0 12 18a4 4 0 0 0 4-3.9c0-2.8-1.7-4.9-4-7.1 0 2.7-1.2 4-2.2 5.1"/><path d="M12 21c-4.7 0-7.5-2.7-7.5-6.6 0-3.1 1.8-5.4 4.8-8.2"/></svg>',
  void:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M4 12c0-4.7 3.1-8 8-8 2.3 0 4.2.7 5.7 2-3.4-.3-5.7 1.2-6.8 3.7M20 12c0 4.7-3.1 8-8 8-2.3 0-4.2-.7-5.7-2 3.4.3 5.7-1.2 6.8-3.7"/></svg>',
  stasis:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M4.5 6.3l15 11.4M19.5 6.3l-15 11.4M12 5l-2 2m2-2 2 2M12 19l-2-2m2 2 2-2M6.7 8l.2 2.8M6.7 8l2.8-.5M17.3 8l-.2 2.8M17.3 8l-2.8-.5"/></svg>',
  strand:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7c4 0 4 10 8 10s4-10 8-10M4 17c4 0 4-10 8-10s4 10 8 10"/><path d="M7 5v14M17 5v14"/></svg>',
  prismatic:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 7 10-7 10L5 12Z"/><path d="M12 2v20M5 12h14M8.5 7 15.5 17M15.5 7 8.5 17"/></svg>'
};

function syncSubclassIcons(){
  installFinalAuthorityStyle();
  const active=String(document.documentElement.dataset.subclass||"").toLowerCase();
  document.querySelectorAll(".subclass-option[data-subclass-option]").forEach(button=>{
    const key=String(button.dataset.subclassOption||"").toLowerCase();
    const holder=button.querySelector(".subclass-option__diamond>span");
    if(holder&&ICONS[key]&&holder.dataset.iconMapped!==key){
      holder.innerHTML=ICONS[key];
      holder.dataset.iconMapped=key;
    }
    button.setAttribute("aria-pressed",String(key===active));
  });
}

function swapSuperSlots(clicked){
  const cluster=document.getElementById("superFeatureCluster");
  if(!cluster||!clicked?.classList.contains("super-diamond--alt")||!clicked.classList.contains("has-live-icon"))return;
  const equipped=cluster.querySelector(".super-diamond--equipped");
  if(!equipped)return;
  const equippedHolder=equipped.querySelector("span");
  const clickedHolder=clicked.querySelector("span");
  if(!equippedHolder||!clickedHolder)return;

  const oldMarkup=equippedHolder.innerHTML;
  const oldTitle=equipped.title;
  const oldLive=equipped.classList.contains("has-live-icon");
  equippedHolder.innerHTML=clickedHolder.innerHTML;
  equipped.title=clicked.title;
  equipped.classList.toggle("has-live-icon",clicked.classList.contains("has-live-icon"));
  clickedHolder.innerHTML=oldMarkup;
  clicked.title=oldTitle;
  clicked.classList.toggle("has-live-icon",oldLive);

  const name=document.getElementById("subclassName");
  if(name&&equipped.title)name.textContent=equipped.title.replace(/ · icon unresolved$/i,"");
  cluster.querySelectorAll(".super-diamond").forEach(slot=>slot.setAttribute("aria-selected",String(slot===equipped)));
}

function bindSuperSelection(){
  installFinalAuthorityStyle();
  const cluster=document.getElementById("superFeatureCluster");
  if(!cluster||cluster.dataset.superPolishBound)return;
  cluster.dataset.superPolishBound="true";
  cluster.addEventListener("click",event=>swapSuperSlots(event.target.closest(".super-diamond")));
  cluster.addEventListener("keydown",event=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    const slot=event.target.closest(".super-diamond");
    if(!slot)return;
    event.preventDefault();
    swapSuperSlots(slot);
  });
  cluster.querySelectorAll(".super-diamond").forEach(slot=>{
    slot.tabIndex=0;
    slot.setAttribute("role","option");
    slot.setAttribute("aria-selected",String(slot.classList.contains("super-diamond--equipped")));
  });
}

const observer=new MutationObserver(()=>{syncSubclassIcons();bindSuperSelection();});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["data-subclass","class"]});
queueMicrotask(()=>{syncSubclassIcons();bindSuperSelection();});

document.addEventListener("astrix:guardian-selection-changed",()=>queueMicrotask(syncSubclassIcons));

export {syncSubclassIcons,bindSuperSelection,installFinalAuthorityStyle};
