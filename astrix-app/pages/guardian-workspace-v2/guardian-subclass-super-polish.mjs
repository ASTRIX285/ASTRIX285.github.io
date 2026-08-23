const STYLE_HREF="./guardian-subclass-super-polish.css?v=20260823-tester-fix-1";
if(!document.querySelector('link[data-astrix-subclass-super-polish]')){
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href=STYLE_HREF;
  link.dataset.astrixSubclassSuperPolish="true";
  document.head.append(link);
}

/* Subclass artwork is owned by guardian-super-feature-sync.mjs and comes from
 * Bungie definitions. Never replace it with synthetic glyphs here. */
function installStaticSubclassIcons(){
  document.querySelectorAll(".subclass-option[data-subclass-option]").forEach(button=>{
    button.dataset.subclassIconSource="bungie";
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
