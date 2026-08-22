/* ASTRIX PARADOX — semantic UI bridge
   Renders resolved live semantics into the approved Guardian Build Forge without
   redesigning its structure. Unknown evidence is shown as unknown, never inferred. */

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bungieIcon=v=>{const s=String(v??"");return !s?"":s.startsWith("http")?s:`https://www.bungie.net${s}`;};
const text=v=>String(v?.name??v?.displayName??v??"").trim();

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

function chip(label,klass=""){return label?`<span class="semantic-chip ${klass}">${esc(label)}</span>`:"";}

function armourSummary(item){
  const s=item?.armourSemantics;
  if(!s)return "";
  const rows=[];
  if(s.tier!=null)rows.push(chip(`T${s.tier}`));
  if(s.energy?.capacity!=null)rows.push(chip(`Energy ${s.energy.used??0}/${s.energy.capacity}`));
  if(s.masterwork)rows.push(chip(text(s.masterwork),"active"));
  if(s.archetype)rows.push(chip(text(s.archetype)));
  if(s.exoticPerk)rows.push(chip(text(s.exoticPerk),"active"));
  if(s.set?.identity)rows.push(chip(`${text(s.set.identity)} ${s.set.equippedCount??0}pc`));
  if(s.set?.twoPiece)rows.push(chip(`2pc ${text(s.set.twoPiece)}`,s.set.twoPiece.active?"active":""));
  if(s.set?.fourPiece)rows.push(chip(`4pc ${text(s.set.fourPiece)}`,s.set.fourPiece.active?"active":""));
  if(s.unknownPlugs?.length||s.set?.unresolved)rows.push(chip(`${(s.unknownPlugs?.length||0)+(s.set?.unresolved?1:0)} unknown`,"warn"));
  return `<div class="gear-semantic-summary"><div class="semantic-meta">${rows.join("")}</div></div>`;
}

function renderArmourSemantics(armour=[]){
  const columns=document.querySelector(".gear-combined .gear-columns");
  if(!columns)return;
  columns.querySelectorAll(".gear-slot").forEach((slot,index)=>{
    slot.querySelector(".gear-semantic-summary")?.remove();
    const item=armour[index];
    const summary=armourSummary(item);
    if(!summary)return;
    const divider=slot.querySelector(".gear-slot-divider");
    if(divider)divider.insertAdjacentHTML("beforebegin",summary);
    else slot.insertAdjacentHTML("beforeend",summary);
  });
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

function renderWeapons(weapons=[]){
  const cards=[...document.querySelectorAll(".gear-weapons .weap-grid .weap")];
  cards.forEach((card,index)=>{
    const item=weapons[index];
    if(!item)return;
    card.classList.add("semantic-live");
    const art=card.querySelector(".art");
    const icon=bungieIcon(item.icon);
    const rank=Number(item.weaponLevel??item.rank??item.itemLevel);
    const hasRank=Number.isFinite(rank)&&rank>0;
    const seasonIcon=bungieIcon(item.tierIcon??item.definition?.iconWatermark??item.definition?.quality?.displayVersionWatermarkIcons?.[0]);
    const gearTier=Math.max(0,Math.min(5,Number(item.gearTier)||0));
    card.classList.toggle("is-level-gold",hasRank&&rank>=10);
    if(art){
      art.classList.toggle("ph",!icon);
      const power=Number(item.power)||"—";
      art.innerHTML=`<span class="pw">${esc(power)}</span>${seasonIcon||gearTier?`<span class="weapon-tier-rail">${seasonIcon?`<span class="weapon-season-icon" title="Season/source emblem"><img src="${esc(seasonIcon)}" alt=""></span>`:""}${Array.from({length:gearTier},()=>'<i class="weapon-tier-diamond" aria-hidden="true"></i>').join("")}</span>`:""}${hasRank?`<span class="weapon-rank" title="Bungie weapon rank">LVL ${esc(rank)}</span>`:""}${icon?`<img src="${esc(icon)}" alt="${esc(item.name||"Weapon")}">`:'<span class="ph-glyph">⌖</span>'}`;
    }
    const cap=card.querySelector(".cap");
    if(cap)cap.innerHTML=`<b>${esc(item.name||"Weapon")}</b><small title="${esc(weaponSubtitle(item))}">${esc(weaponSubtitle(item))}</small>`;
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
  node.textContent=unknown?`${unknown} UNKNOWN`:`EVIDENCE VERIFIED`;
  node.title=unknown?"Unresolved/unclassified evidence is excluded from Paradox claims":"All equipped armour and weapon semantic evidence resolved";
}

function render(detail){
  if(!detail||detail.source!=="bungie-live")return;
  ensureStyle();
  requestAnimationFrame(()=>{
    renderArmourSemantics(detail.armour||[]);
    renderWeapons(detail.weapons||[]);
    renderStats(detail);
    renderArtifactStatus(detail);
    renderCoverage(detail);
  });
}

document.addEventListener("astrix:guardian-selection-changed",event=>render(event.detail));
ensureStyle();

export {render};
