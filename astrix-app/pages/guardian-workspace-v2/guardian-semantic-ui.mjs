/* ASTRIX PARADOX — semantic UI bridge
   Renders resolved live semantics into the approved Guardian Build Forge without
   redesigning its structure. Unknown evidence is shown as unknown, never inferred. */

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bungieIcon=v=>{const s=String(v??"");return !s?"":s.startsWith("http")?s:`https://www.bungie.net${s}`;};
const text=v=>String(v?.name??v?.displayName??v??"").trim();
const WEAPON_STATS=[[4043523819,"Impact"],[1240592695,"Range"],[155624089,"Stability"],[943549884,"Handling"],[4188031367,"Reload Speed"],[1345609583,"Aim Assistance"],[3555269338,"Zoom"],[2715839340,"Airborne Effectiveness"],[4284893193,"Rounds Per Minute"],[3871231066,"Magazine"],[2714457168,"Recoil Direction"]];

function weaponDetailTile(item,label=""){
  if(!item)return "";
  const icon=bungieIcon(item.icon??item.displayProperties?.icon);
  return `<div class="weapon-detail-tile" title="${esc([text(item),item.description].filter(Boolean).join(" — "))}">${icon?`<img src="${esc(icon)}" alt="">`:"◆"}<span>${esc(label||text(item)||"Resolved item")}</span></div>`;
}

function openWeaponDetail(item){
  let host=document.getElementById("weaponDetailDrawer");
  if(!host){
    document.body.insertAdjacentHTML("beforeend",`<div class="weapon-detail-backdrop" data-close-weapon></div><aside class="weapon-detail-drawer" id="weaponDetailDrawer" aria-hidden="true"><button class="weapon-detail-close" type="button" data-close-weapon aria-label="Close weapon details">✕</button><div class="weapon-detail-content"></div></aside>`);
    host=document.getElementById("weaponDetailDrawer");
    document.querySelectorAll("[data-close-weapon]").forEach(node=>node.addEventListener("click",()=>{document.body.classList.remove("weapon-detail-open");host?.setAttribute("aria-hidden","true");}));
  }
  const s=item?.weaponSemantics||{};
  const stats=s.stats||item?.weaponStats||{};
  const statRows=WEAPON_STATS.map(([hash,name])=>{const raw=stats?.[hash]??stats?.[String(hash)];const value=Number(raw?.value??raw);return Number.isFinite(value)?`<div class="weapon-stat"><span>${esc(name)}</span><i><b style="width:${Math.max(0,Math.min(100,value))}%"></b></i><strong>${esc(value)}</strong></div>`:"";}).join("");
  const perks=[s.intrinsic,...(s.selectedPerks||[])].filter(Boolean);
  const mods=[s.masterwork,s.mod,s.catalyst].filter(Boolean);
  const advice=item?.weaponRollAdvice||null;
  const adviceMarkup=advice?.hasVerifiedRecommendation?`<h3>PARADOX PERK RECOMMENDATION</h3><div class="weapon-roll-advice"><b>${esc(advice.alreadySelected?"Current selected perks already support this build":"Verified owned-roll match")}</b><p>${esc(advice.best?.reasons?.join(" · ")||"")}</p><div class="weapon-detail-tiles">${(advice.best?.options||[]).map(option=>`<span class="weapon-advice-option">${esc(option.name||`Perk ${option.hash}`)}</span>`).join("")}</div><small>${esc(advice.action?.remotePerkMutationSupported?"Requires confirmation before applying.":"Recommendation staged; live Bungie apply route is not yet enabled.")}</small></div>`:`<h3>PARADOX PERK RECOMMENDATION</h3><p class="weapon-detail-empty">No verified selectable perk match is currently supported by curated Paradox intelligence.</p>`;
  const content=host.querySelector(".weapon-detail-content");
  if(content)content.innerHTML=`<header class="weapon-detail-head"><div class="weapon-detail-icon"><img src="${esc(bungieIcon(item.icon))}" alt=""></div><div><h2>${esc(item.name||"Weapon")}</h2><p>${esc(item.itemTypeDisplayName||item.weaponType||"Weapon")}</p></div><div class="weapon-detail-power"><small>POWER</small><b>${esc(item.power??"—")}</b></div></header><p class="weapon-flavour">${esc(item.description||"")}</p><div class="weapon-detail-grid"><section><h3>WEAPON PERKS</h3><div class="weapon-detail-tiles">${perks.map(x=>weaponDetailTile(x)).join("")||'<p class="weapon-detail-empty">No resolved perk evidence.</p>'}</div><h3>WEAPON MODS</h3><div class="weapon-detail-tiles">${mods.map(x=>weaponDetailTile(x)).join("")||'<p class="weapon-detail-empty">No resolved mod evidence.</p>'}</div>${s.intrinsic?`<h3>INTRINSIC TRAIT</h3>${weaponDetailTile(s.intrinsic)}`:""}${adviceMarkup}</section><section><h3>WEAPON STATS</h3><div class="weapon-stats">${statRows||'<p class="weapon-detail-empty">Stats unresolved.</p>'}</div></section></div>`;
  host.setAttribute("aria-hidden","false");document.body.classList.add("weapon-detail-open");
}

function ensureStyle(){
  if(document.getElementById("guardianSemanticUiStyle"))return;
  const style=document.createElement("style");
  style.id="guardianSemanticUiStyle";
  style.textContent=`
    .semantic-meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;min-height:16px}
    .semantic-chip{display:inline-flex;align-items:center;max-width:100%;padding:2px 5px;border:1px solid rgba(255,255,255,.12);border-radius:3px;background:rgba(255,255,255,.035);font:600 9px/1.2 Inter,sans-serif;letter-spacing:.025em;color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .semantic-chip.active{border-color:rgba(99,255,193,.3);color:rgba(171,255,220,.92)}
    .semantic-chip.warn{border-color:rgba(255,193,92,.28);color:rgba(255,214,142,.9)}
    .semantic-detail{margin-top:4px;font:500 9px/1.3 Inter,sans-serif;color:rgba(255,255,255,.52);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .weap.semantic-live .cap small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gear-slot .gear-semantic-summary{padding:0 2px 5px}
    .stats-row .stat.semantic-enhanced,.stats-row .stat-box.semantic-enhanced{box-shadow:inset 0 0 0 1px rgba(118,210,255,.28)}
    .stats-row .semantic-threshold{font-size:8px;letter-spacing:.06em;color:rgba(145,220,255,.82)}
  `;
  document.head.appendChild(style);
}

function weaponSubtitle(item){
  const s=item?.weaponSemantics;
  if(!s)return "Awaiting resolved weapon semantics";
  const parts=[];
  if(s.intrinsic)parts.push(text(s.intrinsic));
  if(s.selectedPerks?.length)parts.push(s.selectedPerks.map(text).filter(Boolean).join(" · "));
  if(s.masterwork)parts.push(text(s.masterwork));
  if(s.mod)parts.push(text(s.mod));
  if(s.catalyst)parts.push(`Catalyst: ${text(s.catalyst)}${s.catalyst?.progress?.active?" active":" inactive"}`);
  if(s.champion?.breakerType!=null||s.champion?.breakerTypeHash!=null)parts.push("Champion capability resolved");
  return parts.filter(Boolean).join(" · ")||"No active perk evidence resolved";
}

function isEnhancedPerk(perk){
  if(perk?.isEnhanced===true||perk?.enhanced===true||perk?.definition?.isEnhanced===true)return true;
  const category=String(perk?.definition?.plug?.plugCategoryIdentifier||perk?.plugCategoryIdentifier||"").toLowerCase();
  const traits=[...(perk?.definition?.traitIds||[]),...(perk?.traitIds||[])].map(value=>String(value).toLowerCase());
  return category.includes("enhanced")||traits.some(value=>value.includes("enhanced"))||/^enhanced\b/i.test(String(perk?.name||perk?.displayProperties?.name||""));
}

function weaponMasterworkRank(item){
  if(item?.isExotic)return 10;
  const plug=item?.weaponSemantics?.masterwork;
  const values=(plug?.definition?.investmentStats||[]).map(row=>Math.abs(Number(row?.value))).filter(Number.isFinite);
  return values.length?Math.max(0,Math.min(10,values[0])):null;
}

function renderWeapons(weapons=[]){
  const cards=[...document.querySelectorAll(".gear-weapons .weap-grid .weap")];
  cards.forEach((card,index)=>{
    const item=weapons[index];
    if(!item)return;
    card.classList.add("semantic-live");
    if(!card.dataset.weaponDetailBound){card.dataset.weaponDetailBound="true";card.tabIndex=0;card.setAttribute("role","button");card.addEventListener("click",()=>{const current=card._astrixWeapon;if(current)openWeaponDetail(current);});card.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&card._astrixWeapon){event.preventDefault();openWeaponDetail(card._astrixWeapon);}});}
    card._astrixWeapon=item;
    const art=card.querySelector(".art");
    const icon=bungieIcon(item.icon);
    const rank=weaponMasterworkRank(item);
    const hasRank=Number.isFinite(rank)&&rank>0;
    const seasonIcon=bungieIcon(item.tierIcon??item.definition?.iconWatermark??item.definition?.quality?.displayVersionWatermarkIcons?.[0]);
    const gearTier=Math.max(0,Math.min(5,Number(item.gearTier)||0));
    card.classList.toggle("is-level-gold",hasRank&&rank>=10);
    const semantics=item.weaponSemantics||{};
    const intrinsicIcon=bungieIcon(semantics.intrinsic?.icon);
    const championIcon=bungieIcon(item.breakerDefinition?.displayProperties?.icon);
    const equippedMod=semantics.mod||semantics.selectedMod||item.weaponMod||item.mod;
    const equippedModIcon=bungieIcon(equippedMod?.icon||equippedMod?.displayProperties?.icon);
    const masterwork=semantics.masterwork;
    const masterworkIcon=bungieIcon(masterwork?.icon||masterwork?.displayProperties?.icon||masterwork?.definition?.displayProperties?.icon);
    const masterworkName=text(masterwork)||masterwork?.definition?.displayProperties?.name||"Resolved masterwork";
    const elementIcon=bungieIcon(item.elementDefinition?.displayProperties?.icon||item.elementDefinition?.transparentIconPath);
    if(art){
      art.classList.toggle("ph",!icon);
      const power=Number(item.power)||"—";
      art.innerHTML=`${icon?`<img class="weapon-art-image" src="${esc(icon)}" alt="${esc(item.name||"Weapon")}">`:'<span class="ph-glyph">⌖</span>'}${seasonIcon||gearTier?`<span class="weapon-tier-rail">${seasonIcon?`<span class="weapon-season-icon" title="Season/source emblem"><img src="${esc(seasonIcon)}" alt=""></span>`:""}${Array.from({length:gearTier},()=>'<i class="weapon-tier-diamond" aria-hidden="true"></i>').join("")}</span>`:""}<span class="weapon-right-rail">${intrinsicIcon?`<span class="weapon-corner-icon is-intrinsic" title="Intrinsic trait"><img src="${esc(intrinsicIcon)}" alt=""></span>`:""}${championIcon?`<span class="weapon-corner-icon is-champion" title="Champion capability"><img src="${esc(championIcon)}" alt=""></span>`:""}</span>${hasRank&&rank<10?`<span class="weapon-rank" title="Weapon mod rank">LVL ${esc(rank)}</span>`:""}<span class="weapon-power">${elementIcon?`<img src="${esc(elementIcon)}" alt="">`:""}<b>${esc(power)}</b></span>`;
    }
    const cap=card.querySelector(".cap");
    if(cap)cap.innerHTML=`<b>${esc(item.name||"Weapon")}</b><small title="${esc(weaponSubtitle(item))}">${esc(weaponSubtitle(item))}</small>`;
    let perkStrip=card.querySelector(".weapon-perk-strip");
    if(!perkStrip){perkStrip=document.createElement("div");perkStrip.className="weapon-perk-strip";perkStrip.setAttribute("aria-label","Resolved weapon perks");card.append(perkStrip);}
    const selectedPerks=(semantics.selectedPerks||[]).filter(perk=>bungieIcon(perk?.icon));
    perkStrip.innerHTML=selectedPerks.map(perk=>`<span class="weapon-perk-icon ${isEnhancedPerk(perk)?"is-enhanced":""}" title="${esc(perk.name||"Resolved perk")}"><img src="${esc(bungieIcon(perk.icon))}" alt="${esc(perk.name||"")}"></span>`).join("");
    perkStrip.hidden=selectedPerks.length===0;
    let supportStrip=card.querySelector(".weapon-support-icons");
    if(!supportStrip){supportStrip=document.createElement("div");supportStrip.className="weapon-support-icons";supportStrip.setAttribute("aria-label","Equipped weapon mod and masterwork");card.append(supportStrip);}
    supportStrip.innerHTML=`${equippedModIcon?`<span class="weapon-support-icon is-mod" title="${esc(text(equippedMod)||"Equipped weapon mod")}"><img src="${esc(equippedModIcon)}" alt=""></span>`:""}${masterworkIcon?`<span class="weapon-support-icon is-masterwork" title="${esc(masterworkName)}"><img src="${esc(masterworkIcon)}" alt=""></span>`:""}`;
    supportStrip.hidden=!equippedModIcon&&!masterworkIcon;
  });
}

function renderStats(detail){
  const host=document.getElementById("statsRow");
  if(!host)return;
  const entries=Array.isArray(detail?.stats)?detail.stats:[];
  const model=detail?.statModel||{};
  host.innerHTML=entries.map(([name,value])=>{
    const row=model[name]||model[String(name)]||{};
    const enhanced=Boolean(row.enhancedThresholdReached);
    return `<div class="stat ${enhanced?"semantic-enhanced":""}"><span>${esc(name)}</span><b>${esc(value)}</b>${enhanced?'<small class="semantic-threshold">100+ ENHANCED</small>':""}</div>`;
  }).join("");
}

function renderArtifactStatus(detail){
  const host=document.querySelector(".grp--artifact .artifact-copy");
  if(!host)return;
  host.querySelector(".semantic-detail")?.remove();
  const v=detail?.artifactValidation;
  if(!v)return;
  const label=v.activeCount!=null?`${v.activeCount} applied perk${v.activeCount===1?"":"s"}${v.noDuplicateActiveHashes?" · unique":" · duplicate hash detected"}`:"Artifact state unresolved";
  host.insertAdjacentHTML("beforeend",`<span class="semantic-detail">${esc(label)}</span>`);
}

function renderCoverage(detail){
  const node=document.querySelector(".gear-combined .tools");
  if(!node)return;
  const armour=detail?.hashCoverage?.armour;
  const weapons=detail?.hashCoverage?.weapons;
  const unknown=(armour?.unresolved?.length||0)+(armour?.semanticUnknown?.length||0)+(weapons?.unresolved?.length||0)+(weapons?.semanticUnknown?.length||0);
  node.textContent=unknown?`PARTIAL EVIDENCE`:`EVIDENCE VERIFIED`;
  node.title=unknown?"Unresolved/unclassified evidence is excluded from Paradox claims":"All equipped armour and weapon semantic evidence resolved";
}

function render(detail){
  if(!detail||detail.source!=="bungie-live")return;
  ensureStyle();
  requestAnimationFrame(()=>{
    renderWeapons(detail.weapons||[]);
    renderStats(detail);
    renderArtifactStatus(detail);
    renderCoverage(detail);
  });
}

document.addEventListener("astrix:guardian-selection-changed",event=>render(event.detail));
ensureStyle();

export {render,renderWeapons};
