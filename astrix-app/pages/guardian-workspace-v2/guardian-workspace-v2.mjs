const PLAYER_POWER_CAP = 550;
const STAT_CAP = 200;

const ART = {
  crest: "https://www.bungie.net/common/destiny2_content/icons/32b112a9460e6f0e2b9ee15dc53fe1c1.png",
  super: { name: "Shadowshot: Moebius Quiver", icon: "https://www.bungie.net/common/destiny2_content/icons/986e8f2dd0699371d605a331bb63742a.png" },
  aspects: [
    { name: "Stylish Executioner", icon: "https://www.bungie.net/common/destiny2_content/icons/ed7f8c49b77fa46f4eec87a3c167c4b1.jpg" },
    { name: "Trapper's Ambush", icon: "https://www.bungie.net/common/destiny2_content/icons/e91760df2b81d191da9e2c62cb3fcda7.jpg" }
  ],
  fragments: [
    { name: "Echo of Persistence", icon: "https://www.bungie.net/common/destiny2_content/icons/914309029085289921f77d8207765150.jpg" },
    { name: "Echo of Undermining", icon: "https://www.bungie.net/common/destiny2_content/icons/b114e9d97c42a68b19ab7876a221b354.jpg" },
    { name: "Echo of Starvation", icon: "https://www.bungie.net/common/destiny2_content/icons/19219ecd56fef82e9ead65aed8fea63a.jpg" },
    { name: "Echo of Obscurity", icon: "https://www.bungie.net/common/destiny2_content/icons/7d711ce4bcfb264da29c289ff70b9876.jpg" }
  ],
  artifact: {
    name: "Implement of Curiosity",
    icon: "https://www.bungie.net/common/destiny2_content/icons/9a2c53359db42bf87f48304efe7cae7b.png",
    perks: [
      { name: "Anti-Barrier Hand Cannon", icon: "https://www.bungie.net/common/destiny2_content/icons/9a2c53359db42bf87f48304efe7cae7b.png" },
      { name: "Dielectric", icon: "https://www.bungie.net/common/destiny2_content/icons/2ba8a6fb47d9a36d8e5651bad5a86752.png" },
      { name: "Elemental Orbs: Arc", icon: "https://www.bungie.net/common/destiny2_content/icons/57df71b415811ddee77e55f4b95519aa.png" }
    ]
  }
};

const abilities = [
  { label: "SUPER", name: ART.super.name, icon: ART.super.icon, super: true },
  { label: "CLASS ABILITY", name: "Marksman Dodge", icon: "" },
  { label: "MOVEMENT", name: "Triple Jump", icon: "" },
  { label: "MELEE", name: "Smoke Bomb", icon: "" },
  { label: "GRENADE", name: "Vortex Grenade", icon: "" }
];
/* Armor 3.0 (Edge of Fate, July 2025 onwards). Six stats scale 1–200.
 * 1:1 rename from the retired system: Mobility→Weapons, Resilience→Health,
 * Recovery→Class, Discipline→Grenade, Intellect→Super, Strength→Melee.
 * The numbers below are placeholders until fixtures carry real stat blocks —
 * the workspace shows an "awaiting live data" tag on the stats card. */
const previewStats = [["Weapons",100],["Health",42],["Class",70],["Grenade",101],["Super",28],["Melee",38]];
const VALID_CLASSES = ["hunter","titan","warlock"];
const VALID_SUBCLASSES = ["void","solar","arc","stasis","strand","prismatic"];
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);

function loadBetaStyles(){
  ["guardian-background-beta.css","guardian-workspace-v2-beta.css"].forEach(href=>{
    if(document.querySelector(`link[href="./${href}"]`)) return;
    const link=document.createElement("link");link.rel="stylesheet";link.href=`./${href}`;document.head.appendChild(link);
  });
}

function iconMarkup(url,alt){return url?`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" onerror="this.style.display='none'">`:'<span class="ph-glyph">◆</span>'}

function renderVerifiedPreview(){
  byId("scCrest").src=ART.crest;
  byId("abilityList").innerHTML=abilities.map(a=>`<div class="ability-row"><span class="ico-badge ${a.super?"super":""}">${iconMarkup(a.icon,a.name)}</span><div class="meta"><small>${escapeHtml(a.label)}</small><b>${escapeHtml(a.name)}</b></div></div>`).join("");
  byId("aspectList").innerHTML=ART.aspects.map(a=>`<div class="slot"><span class="ico-badge">${iconMarkup(a.icon,a.name)}</span><span class="nm">${escapeHtml(a.name)}</span><span class="cfg">⚙</span></div>`).join("");
  byId("fragList").innerHTML=ART.fragments.map(f=>`<div class="slot"><span class="ico-badge">${iconMarkup(f.icon,f.name)}</span><span class="nm">${escapeHtml(f.name)}</span></div>`).join("");
  byId("artName").textContent=ART.artifact.name;byId("artIcon").src=ART.artifact.icon;
  byId("artPerks").innerHTML=ART.artifact.perks.map(p=>`<img src="${escapeHtml(p.icon)}" alt="${escapeHtml(p.name)}" title="${escapeHtml(p.name)}" onerror="this.style.display='none'">`).join("");
  renderStats(previewStats);
  byId("modsGrid").innerHTML=Array.from({length:9},()=>`<div class="mod ph" title="Awaiting verified armour-mod plug data"><span class="ph-glyph">◆</span></div>`).join("");
  document.querySelectorAll("[data-power-cap]").forEach(el=>el.textContent=PLAYER_POWER_CAP);
}

function renderStats(stats){
  const values=Array.isArray(stats)&&stats.length?stats:previewStats;
  const total=values.reduce((sum,[,value])=>sum+Number(value||0),0);
  byId("statsRow").innerHTML=values.map(([name,value])=>`<div class="st"><span class="nm">${escapeHtml(name)}</span><span class="bar"><i style="width:${Math.min(100,(Number(value||0)/STAT_CAP)*100)}%"></i></span><span class="v">${Number(value||0)}</span></div>`).join("")+`<div class="st total"><span class="nm">Total</span><span></span><span class="v">${total}</span></div>`;
}

const PLATFORM_MARKUP=`<svg class="gp-defs" aria-hidden="true"><filter id="gp-smoke" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="7" stitchTiles="stitch" result="noise"><animate attributeName="seed" from="0" to="60" dur="70s" repeatCount="indefinite"/></feTurbulence><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.25 -0.46" result="alpha"/><feComposite in="SourceGraphic" in2="alpha" operator="in" result="tinted"/><feGaussianBlur in="tinted" stdDeviation="6"/></filter></svg><svg class="mist mist-back" viewBox="0 0 300 240" preserveAspectRatio="none" aria-hidden="true"><rect width="300" height="240"/></svg><div class="frontglow"></div><div class="deck"><i class="aura"></i><i class="step"></i><i class="wall"></i><i class="face"></i><i class="grain"></i><i class="cast"></i><i class="frame"></i><i class="sigil"></i><i class="hub"></i><i class="ring ring-outer"></i><i class="ring ring-mid"></i><i class="ring ring-inner"></i><i class="depth"></i></div><svg class="mist mist-front" viewBox="0 0 300 130" preserveAspectRatio="none" aria-hidden="true"><rect width="300" height="130"/></svg>`;

const workspaceState={characterId:null,characterClass:"hunter",subclass:"void",renderUrl:null,power:PLAYER_POWER_CAP,stats:null,weapons:[],armour:[],emblem:null,ghost:null,shader:null,ornaments:[]};

function normaliseSelection(detail={}){
  const characterClass=String(detail.characterClass??detail.className??detail.classType??workspaceState.characterClass).toLowerCase();
  const subclass=String(detail.subclass??workspaceState.subclass).toLowerCase();
  if(!VALID_CLASSES.includes(characterClass)||!VALID_SUBCLASSES.includes(subclass)) return null;
  return {...workspaceState,...detail,characterClass,subclass};
}

function setStageState(state,message=""){
  const stage=document.querySelector(".stage");if(!stage)return;stage.dataset.state=state||"ready";
  let overlay=stage.querySelector(".stage-state");
  if(!overlay){overlay=document.createElement("div");overlay.className="stage-state";overlay.innerHTML='<div class="stage-state-card"></div>';stage.appendChild(overlay)}
  overlay.querySelector(".stage-state-card").textContent=message||"Loading Guardian data…";
}

function applyGuardianSelection(detail){
  const next=normaliseSelection(detail);if(!next)return;
  Object.assign(workspaceState,next);
  const stage=document.querySelector(".stage");const platform=byId("guardianPlatform");if(!stage||!platform)return;
  stage.dataset.class=next.characterClass;stage.dataset.subclass=next.subclass;
  platform.classList.remove(...VALID_SUBCLASSES);platform.classList.add(next.subclass);
  const render=byId("guardianRender");
  if(next.renderUrl){
    setStageState("loading","Loading selected Guardian…");
    render.onload=()=>setStageState("ready");
    render.onerror=()=>{render.style.display="none";setStageState("error","Guardian render could not be loaded.")};
    render.style.display="block";
    render.src=next.renderUrl;
  }else{
    render.removeAttribute("src");
    render.style.display="none";
    setStageState("ready");
  }
  if(next.power!=null) document.querySelectorAll("[data-power-cap]").forEach(el=>el.textContent=next.power);
  if(next.stats) renderStats(next.stats);
  if(next.subclassBuild)renderSubclassBuild(next.subclassBuild,next.subclassName);
  if(Array.isArray(next.weapons)) renderWeapons(next.weapons);
  if(Array.isArray(next.armour)) bindArmourSlots(next.armour);
  updateIdentityCosmetics(next);
}

function renderSubclassBuild(build={},subclassName="Subclass"){
  const abilities=Array.isArray(build.abilities)?build.abilities:[];
  const aspects=Array.isArray(build.aspects)?build.aspects:[];
  const fragments=Array.isArray(build.fragments)?build.fragments:[];
  const abilityHost=byId("abilityList");
  const aspectHost=byId("aspectList");
  const fragmentHost=byId("fragList");
  if(abilityHost&&abilities.length)abilityHost.innerHTML=abilities.map(item=>`<div class="ability-row"><span class="ico-badge">${iconMarkup(item.icon,item.name)}</span><div class="meta"><small>${escapeHtml(item.itemTypeDisplayName||subclassName)}</small><b>${escapeHtml(item.name)}</b></div></div>`).join("");
  if(aspectHost)aspectHost.innerHTML=aspects.map(item=>`<div class="slot"><span class="ico-badge">${iconMarkup(item.icon,item.name)}</span><span class="nm">${escapeHtml(item.name)}</span><span class="cfg">⚙</span></div>`).join("");
  if(fragmentHost)fragmentHost.innerHTML=fragments.map(item=>`<div class="slot"><span class="ico-badge">${iconMarkup(item.icon,item.name)}</span><span class="nm">${escapeHtml(item.name)}</span></div>`).join("");
}

function updateIdentityCosmetics(data){
  const shader=document.querySelector(".cos .sw.shader")?.nextElementSibling?.querySelector("b");if(shader)shader.textContent=data.shader?.name||data.shader||"Awaiting live data";
  const ghost=document.querySelector(".cos .sw.ghost")?.nextElementSibling?.querySelector("b");if(ghost)ghost.textContent=data.ghost?.name||data.ghost||"Awaiting live data";
}

function initialiseGuardianPlatform(){const platform=document.querySelector(".stage > .guardian-platform");if(!platform)return;platform.innerHTML=PLATFORM_MARKUP;platform.id="guardianPlatform";platform.classList.add(workspaceState.subclass);const stage=document.querySelector(".stage");stage.dataset.class=workspaceState.characterClass;stage.dataset.subclass=workspaceState.subclass}

function createArmourDrawer(){
  if(byId("armourDrawer"))return;
  document.body.insertAdjacentHTML("beforeend",`<div class="armour-drawer-backdrop" data-close-drawer></div><aside class="armour-drawer" id="armourDrawer" aria-hidden="true"><div class="armour-drawer-head"><div><small class="eyebrow">ARMOUR INSPECTOR</small><h2 id="armourDrawerTitle">Armour slot</h2></div><button class="armour-drawer-close" type="button" data-close-drawer aria-label="Close armour inspector">✕</button></div><div class="armour-drawer-tabs" role="tablist"><button class="armour-tab" data-tab="build" aria-selected="true">BUILD</button><button class="armour-tab" data-tab="appearance" aria-selected="false">APPEARANCE</button><button class="armour-tab" data-tab="mods" aria-selected="false">MODS</button></div><section class="armour-panel active" data-panel="build"></section><section class="armour-panel" data-panel="appearance"></section><section class="armour-panel" data-panel="mods"></section></aside>`);
  document.querySelectorAll("[data-close-drawer]").forEach(el=>el.addEventListener("click",closeArmourDrawer));
  document.querySelectorAll(".armour-tab").forEach(tab=>tab.addEventListener("click",()=>{document.querySelectorAll(".armour-tab").forEach(t=>t.setAttribute("aria-selected",String(t===tab)));document.querySelectorAll(".armour-panel").forEach(p=>p.classList.toggle("active",p.dataset.panel===tab.dataset.tab))}));
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeArmourDrawer()});
}


function renderWeapons(weapons=[]){
  const cards=Array.from(
    document.querySelectorAll(".weap-grid .weap")
  );

  if(!cards.length)return;

  const slotOrder={
    Kinetic:0,
    Special:0,
    Primary:1,
    Energy:1,
    Power:2,
    Heavy:2
  };

  const ordered=[null,null,null];

  weapons.forEach((weapon,index)=>{
    const ammo=String(
      weapon?.ammoType??""
    );

    let slot=slotOrder[ammo];

    if(!Number.isInteger(slot)){
      slot=Math.min(index,2);
    }

    while(
      slot<3
      && ordered[slot]
    ){
      slot++;
    }

    if(slot<3){
      ordered[slot]=weapon;
    }
  });

  cards.forEach((card,index)=>{
    const weapon=ordered[index];

    const art=card.querySelector(".art");
    const name=card.querySelector(".cap b");
    const meta=card.querySelector(".cap small");

    if(!weapon){
      if(art){
        art.classList.add("ph");
        art.innerHTML=
          '<span class="pw">—</span>'
          +'<span class="ph-glyph">⌖</span>';
      }

      if(meta){
        meta.textContent="awaiting build data";
      }

      return;
    }

    if(art){
      art.classList.remove("ph");

      const icon=weapon.icon
        ? `<img src="${escapeHtml(weapon.icon)}" `
          +`alt="${escapeHtml(weapon.name||"Weapon")}" `
          +`onerror="this.style.display='none'">`
        : '<span class="ph-glyph">⌖</span>';

      art.innerHTML=
        `<span class="pw">${escapeHtml(
          String(weapon.power??"")
        )}</span>${icon}`;
    }

    if(name){
      name.textContent=
        weapon.name
        || "Unknown weapon";
    }

    if(meta){
      const details=[
        weapon.weaponType,
        weapon.element,
        weapon.ammoType
      ].filter(Boolean);

      meta.textContent=
        details.join(" · ")
        || "Bungie identity resolved";
    }

    card.title=[
      weapon.name,
      weapon.weaponType,
      weapon.element,
      weapon.ammoType
    ].filter(Boolean).join(" — ");
  });
}

function renderArmourFunctionalSlots(armour=[]){
  const cards=[
    ...document.querySelectorAll(".arm-grid .arm")
  ];

  cards.forEach((card,index)=>{
    const item=armour[index]??null;

    card.querySelector(".pf-mod-grid")?.remove();
    card.querySelector(".pf-exotic-trait")?.remove();
    card.classList.remove("pf-exotic-armour");

    const previousPrimary=
      card.querySelector(".pf-primary-armour-image");

    if(previousPrimary){
      previousPrimary.classList.remove(
        "pf-primary-armour-image"
      );
    }

    if(!item)return;

    const trait=item?.intrinsicTrait??null;
    const isExotic=Boolean(trait);
    const slotCount=isExotic?5:6;

    const primaryImage=card.querySelector("img");

    if(primaryImage){
      primaryImage.classList.add(
        "pf-primary-armour-image"
      );
    }

    if(isExotic){
      card.classList.add("pf-exotic-armour");

      const name=
        trait.name
        ??"Exotic intrinsic trait";

      const description=
        trait.description
        ??"";

      const hash=
        trait.bungieHash
        ??trait.hash
        ??"";

      const traitButton=
        document.createElement("button");

      traitButton.type="button";
      traitButton.className="pf-exotic-trait";
      traitButton.title=[
        name,
        description,
        hash?`Bungie hash: ${hash}`:""
      ].filter(Boolean).join(" — ");

      traitButton.setAttribute(
        "aria-label",
        description
          ?`${name}. ${description}`
          :name
      );

      if(trait.icon){
        const img=
          document.createElement("img");

        img.src=trait.icon;
        img.alt=name;
        img.onerror=()=>{
          img.style.display="none";
        };

        traitButton.appendChild(img);
      }else{
        traitButton.textContent="✦";
      }

      card.appendChild(traitButton);
    }

    const grid=
      document.createElement("div");

    grid.className=
      `pf-mod-grid ${
        isExotic
          ?"pf-mod-grid-exotic"
          :"pf-mod-grid-legendary"
      }`;

    grid.setAttribute(
      "aria-label",
      `${slotCount} armour mod slots`
    );

    for(let i=0;i<slotCount;i+=1){
      const slot=
        document.createElement("div");

      slot.className="pf-mod-slot";
      slot.title=`Armour mod slot ${i+1}`;
      slot.innerHTML=
        '<span aria-hidden="true">◇</span>';

      grid.appendChild(slot);
    }

    card.appendChild(grid);
  });
}

function bindArmourSlots(armour=[]){
  renderArmourFunctionalSlots(armour);
  const slots=[...document.querySelectorAll(".arm-grid .arm")];
  slots.forEach((slot,index)=>{slot.tabIndex=0;slot.setAttribute("role","button");slot.dataset.slotIndex=String(index);slot.onclick=()=>openArmourDrawer(index,armour[index]);slot.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openArmourDrawer(index,armour[index])}}});
}

function openArmourDrawer(index,item){
  const names=["Helmet","Gauntlets","Chest Armour","Leg Armour","Class Item"];const resolved=item||null;
  byId("armourDrawerTitle").textContent=resolved?.name||names[index]||"Armour";
  const fallback='<div class="inspector-empty">Awaiting Bungie character and inventory data. No equipment, mods, shader or ornament has been invented for this slot.</div>';
  const field=(label,value)=>`<div class="inspector-field"><small>${escapeHtml(label)}</small><b>${escapeHtml(value??"Awaiting live data")}</b></div>`;
  document.querySelector('[data-panel="build"]').innerHTML=resolved?`<div class="inspector-grid">${field("Power",resolved.power)}${field("Energy",resolved.energy?.type||resolved.energy)}${field("Tier",resolved.tier)}${field("Manifest hash",resolved.hash)}</div>`:fallback;
  document.querySelector('[data-panel="appearance"]').innerHTML=resolved?`<div class="inspector-grid">${field("Shader",resolved.shader?.name||resolved.shader)}${field("Ornament",resolved.ornament?.name||resolved.ornament)}${field("Default appearance",resolved.defaultAppearance||"Available from manifest")}${field("Cosmetic state",resolved.cosmeticState)}</div>`:fallback;
  document.querySelector('[data-panel="mods"]').innerHTML=resolved?.mods?.length?(resolved.intrinsicTrait?field("Exotic trait",resolved.intrinsicTrait.name||"Intrinsic trait"): "")+resolved.mods.map(mod=>field("Armour mod",mod.name||mod)).join(""):fallback;
  document.body.classList.add("armour-drawer-open");byId("armourDrawer").setAttribute("aria-hidden","false");
}
function closeArmourDrawer(){document.body.classList.remove("armour-drawer-open");byId("armourDrawer")?.setAttribute("aria-hidden","true")}

/* Single UI integration contract. Dispatch only after the user selects/loads a character. */
document.addEventListener("astrix:guardian-selection-changed",event=>applyGuardianSelection(event.detail));
document.addEventListener("astrix:guardian-loading",()=>setStageState("loading","Loading Guardian data…"));
document.addEventListener("astrix:guardian-error",event=>setStageState("error",event.detail?.message||"Guardian data could not be loaded."));

loadBetaStyles();initialiseGuardianPlatform();createArmourDrawer();renderVerifiedPreview();bindArmourSlots([]);setStageState("ready");
document.dispatchEvent(new CustomEvent("astrix:guardian-workspace-ready",{detail:{version:"0.1.0-beta",selectionEvent:"astrix:guardian-selection-changed"}}));
