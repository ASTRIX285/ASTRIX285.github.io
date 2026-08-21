const STYLE_HREF="./guardian-subclass-super-polish.css?v=20260821-1135";
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

function installStaticSubclassIcons(){
  document.querySelectorAll(".subclass-option[data-subclass-option]").forEach(button=>{
    const key=String(button.dataset.subclassOption||"").toLowerCase();
    const holder=button.querySelector(".subclass-option__diamond>span");
    if(!holder||!ICONS[key])return;
    if(holder.dataset.staticSubclassIcon===key)return;
    holder.innerHTML=ICONS[key];
    holder.dataset.staticSubclassIcon=key;
  });
}

function syncSubclassActiveState(){
  document.querySelectorAll(".subclass-option[data-subclass-option]").forEach(button=>{
    button.setAttribute("aria-pressed",String(button.classList.contains("is-active")));
  });
}

function slotSnapshot(slot){
  const holder=slot?.querySelector("span");
  return {
    markup:holder?.innerHTML||"◆",
    title:slot?.title||"",
    live:Boolean(slot?.classList.contains("has-live-icon"))
  };
}

function applySlotSnapshot(slot,snapshot){
  if(!slot||!snapshot)return;
  const holder=slot.querySelector("span");
  if(!holder)return;
  holder.innerHTML=snapshot.markup;
  slot.title=snapshot.title;
  slot.classList.toggle("has-live-icon",snapshot.live);
}

function markBottomSelected(cluster){
  const bottom=cluster?.querySelector(".super-diamond--alt3");
  cluster?.querySelectorAll(".super-diamond--alt").forEach(slot=>{
    const selected=slot===bottom;
    slot.classList.toggle("is-selected-super",selected);
    slot.setAttribute("aria-selected",String(selected));
    if(selected)slot.setAttribute("aria-current","true");
    else slot.removeAttribute("aria-current");
  });
}

function swapSuperSlots(clicked){
  const cluster=document.getElementById("superFeatureCluster");
  if(!cluster||!clicked?.classList.contains("super-diamond--alt")||!clicked.classList.contains("has-live-icon"))return;
  const equipped=cluster.querySelector(".super-diamond--equipped");
  const bottom=cluster.querySelector(".super-diamond--alt3");
  if(!equipped||!bottom)return;
  if(clicked===bottom&&clicked.classList.contains("is-selected-super"))return;

  const previousSelected=slotSnapshot(equipped);
  const nextSelected=slotSnapshot(clicked);

  applySlotSnapshot(equipped,nextSelected);
  applySlotSnapshot(bottom,nextSelected);
  if(clicked!==bottom)applySlotSnapshot(clicked,previousSelected);

  const name=document.getElementById("subclassName");
  if(name&&equipped.title)name.textContent=equipped.title.replace(/ · icon unresolved$/i,"");
  markBottomSelected(cluster);
}

function bindSuperSelection(){
  const cluster=document.getElementById("superFeatureCluster");
  if(!cluster)return;
  cluster.querySelectorAll(".super-diamond").forEach(slot=>{
    slot.tabIndex=0;
    slot.setAttribute("role","option");
  });
  markBottomSelected(cluster);
  if(cluster.dataset.superPolishBound)return;
  cluster.dataset.superPolishBound="true";
  cluster.addEventListener("click",event=>swapSuperSlots(event.target.closest(".super-diamond")));
  cluster.addEventListener("keydown",event=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    const slot=event.target.closest(".super-diamond");
    if(!slot)return;
    event.preventDefault();
    swapSuperSlots(slot);
  });
}

function syncPresentation(){
  installStaticSubclassIcons();
  syncSubclassActiveState();
  bindSuperSelection();
}

queueMicrotask(syncPresentation);
document.addEventListener("astrix:guardian-selection-changed",()=>queueMicrotask(syncPresentation));

export {installStaticSubclassIcons,syncSubclassActiveState,bindSuperSelection,syncPresentation};
