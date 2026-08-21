const STYLE_HREF="./guardian-subclass-super-polish.css";
if(!document.querySelector(`link[href="${STYLE_HREF}"]`)){
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href=STYLE_HREF;
  document.head.append(link);
}

const ICONS={
  arc:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 9.8 8.4 4 6l4.5 5.2L3 15l6.7.5L12 22l2.3-6.5L21 15l-5.5-3.8L20 6l-5.8 2.4Z"/></svg>',
  solar:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.8 3.1.2 4.8-1.2 6.2C9.2 10.8 8 12.1 8 14.4A4 4 0 0 0 12 18a4 4 0 0 0 4-3.9c0-2.8-1.7-4.9-4-7.1 0 2.7-1.2 4-2.2 5.1"/><path d="M12 21c-4.7 0-7.5-2.7-7.5-6.6 0-3.1 1.8-5.4 4.8-8.2"/></svg>',
  void:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M4 12c0-4.7 3.1-8 8-8 2.3 0 4.2.7 5.7 2-3.4-.3-5.7 1.2-6.8 3.7M20 12c0 4.7-3.1 8-8 8-2.3 0-4.2-.7-5.7-2 3.4.3 5.7-1.2 6.8-3.7"/></svg>',
  stasis:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M4.5 6.3l15 11.4M19.5 6.3l-15 11.4M12 5l-2 2m2-2 2 2M12 19l-2-2m2 2 2-2M6.7 8l.2 2.8M6.7 8l2.8-.5M17.3 8l-.2 2.8M17.3 8l-2.8-.5"/></svg>',
  strand:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7c4 0 4 10 8 10s4-10 8-10M4 17c4 0 4-10 8-10s4 10 8 10"/><path d="M7 5v14M17 5v14"/></svg>',
  prismatic:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 7 10-7 10L5 12Z"/><path d="M12 2v20M5 12h14M8.5 7 15.5 17M15.5 7 8.5 17"/></svg>'
};

function syncSubclassIcons(){
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

export {syncSubclassIcons,bindSuperSelection};
