const $=(selector,root=document)=>root.querySelector(selector);
const all=(selector,root=document)=>[...root.querySelectorAll(selector)];
const safe=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function card(item,meta=''){
  const icon=item.iconUrl?`<img src="${safe(item.iconUrl)}" alt="${safe(item.name)}">`:'<div class="icon-fallback" aria-hidden="true"></div>';
  return `<button class="build-card${item.equipped?' is-equipped':''}" data-inspect="${safe(item.id)}" type="button">${item.equipped?'<span class="equipped-dot">✓</span>':''}${icon}<strong>${safe(item.name)}</strong><small>${safe(meta||item.state||'Available')}</small></button>`;
}

function setText(selector,value){const node=$(selector);if(node)node.textContent=value??'';}
function setImage(selector,url,alt=''){const node=$(selector);if(!node)return;node.src=url||'';node.alt=alt;node.hidden=!url;}

function renderMeters(measures=[]){return measures.map(item=>`<div class="meter"><label>${safe(item.label)}</label><span class="meter-track"><i style="width:${Math.max(0,Math.min(100,Number(item.value)||0))}%"></i></span><b>${safe(item.value)}%</b></div>`).join('');}
function renderCoverage(items=[]){return items.map(item=>`<div class="coverage-row"><span>${safe(item.label)}</span><strong class="${item.covered?'status-good':'status-bad'}">${item.covered?'✓ Covered':'✕ Missing'}</strong></div>`).join('');}
function renderPath(nodes=[]){return nodes.map((node,index)=>`${index?'<span class="path-arrow">→</span>':''}<span class="path-node">${safe(node)}</span>`).join('');}
function renderRecommendations(items=[]){return items.map(item=>`<article class="recommendation"><strong>${safe(item.title)}</strong><p>${safe(item.reason)}</p></article>`).join('');}

function renderArmour(items=[]){return items.map(item=>`<button class="armour-item" data-inspect="${safe(item.id)}" title="${safe(item.name)}">${safe(item.shortLabel||item.slot)}</button>`).join('');}
function renderStageStats(stats=[]){return stats.map(item=>`<div>${safe(item.value)} · ${safe(item.name)}</div>`).join('');}
function dockCard(item){return `<article class="dock-card" data-inspect="${safe(item.id)}"><h3>${safe(item.slot)}</h3><div class="dock-main">${item.iconUrl?`<img src="${safe(item.iconUrl)}" alt="${safe(item.name)}">`:''}<div><strong>${safe(item.name)}</strong><small>${safe(item.type||'Preview equipment')}</small><b>${item.power?safe(item.power):'Preview'}</b></div></div></article>`;}
function statsCard(stats=[]){return `<article class="dock-card"><h3>Stats</h3>${stats.map(item=>`<div class="stat-row"><span>${safe(item.name)}</span><span><i style="width:${Math.min(100,Number(item.value)||0)}%"></i></span><b>${safe(item.value)}</b></div>`).join('')}</article>`;}
function modsCard(mods=[]){return `<article class="dock-card"><h3>Armor Mods</h3><div class="mods-grid">${(mods.length?mods:Array.from({length:8},(_,i)=>({name:`Mod ${i+1}`}))).map(mod=>`<div class="mod-box" title="${safe(mod.name)}">◇</div>`).join('')}</div></article>`;}
function activityCard(activity){return `<article class="dock-card"><h3>Activity Context</h3><strong>${safe(activity?.name||'No activity selected')}</strong><p>${activity?`Champions: ${safe((activity.champions||[]).join(', ')||'None')}<br>Surge: ${safe(activity.surge||'None')}`:'Select an activity to adapt recommendations.'}</p></article>`;}

function render(state){
  document.documentElement.style.setProperty('--accent',state.subclass.element.accent||'#9f66ff');
  setText('[data-account]',`${state.player.displayName}${state.player.membershipCode?`#${state.player.membershipCode}`:''}`);
  setText('[data-season]',state.player.seasonLabel||'Preview season');
  setText('[data-preview-banner]',state.notice||'Preview mode');
  setText('[data-subclass-name]',state.subclass.name);
  setText('[data-class-name]',`${state.character.className} SUBCLASS`);
  setText('[data-element]',state.subclass.element.name);
  setText('[data-power]',state.character.power??'PREVIEW');
  setText('[data-stage-power]',state.character.power??'PREVIEW');
  setText('[data-guardian-name]',state.player.displayName);
  setText('[data-title]',state.character.title||'GUARDIAN');
  setImage('[data-subclass-crest]',state.subclass.element.crestUrl,`${state.subclass.element.name} crest`);
  setImage('[data-fallback-crest]',state.subclass.element.crestUrl,`${state.subclass.element.name} crest`);

  const renderNode=$('[data-guardian-render]');
  const fallback=$('[data-guardian-fallback]');
  if(state.character.renderUrl){renderNode.src=state.character.renderUrl;renderNode.hidden=false;fallback.hidden=true;}else{renderNode.hidden=true;fallback.hidden=false;}

  $('[data-supers]').innerHTML=state.subclass.supers.map(item=>card(item,item.equipped?'Equipped':'Available')).join('');
  $('[data-abilities]').innerHTML=state.subclass.abilities.map(item=>card(item,item.slot)).join('');
  $('[data-aspects]').innerHTML=state.subclass.aspects.map(item=>card(item,`${item.fragmentSlots||0} fragment slots`)).join('');
  $('[data-fragments]').innerHTML=state.subclass.fragments.map(item=>card(item,item.statText||'Fragment')).join('');
  $('[data-artifact]').innerHTML=state.subclass.artifact.perks.map(item=>card({...item,equipped:item.active},item.active?'Active':'Unlocked')).join('');
  setText('[data-aspect-count]',`${state.subclass.aspects.filter(item=>item.equipped).length} equipped`);
  setText('[data-fragment-count]',`${state.subclass.fragments.filter(item=>item.equipped).length} equipped`);

  $('[data-armour]').innerHTML=renderArmour(state.equipment.armour);
  $('[data-stage-stats]').innerHTML=renderStageStats(state.equipment.stats);
  $('[data-build-score]').textContent=state.analysis.buildScore??'--';
  $('[data-measures]').innerHTML=renderMeters(state.analysis.measures);
  $('[data-coverage]').innerHTML=renderCoverage(state.analysis.coverage);
  setText('[data-loop-summary]',state.analysis.loopSummary);
  $('[data-evidence-path]').innerHTML=renderPath(state.analysis.primaryLoop.nodes);
  $('[data-recommendations]').innerHTML=renderRecommendations(state.analysis.recommendations);
  $('[data-activity]').innerHTML=`<strong>${safe(state.activity.name)}</strong><p>Champions: ${safe(state.activity.champions.join(', '))}<br>Surge: ${safe(state.activity.surge)}</p>`;

  const weapons=state.equipment.weapons.map(dockCard).join('');
  $('[data-bottom-dock]').innerHTML=weapons+modsCard(state.equipment.mods)+statsCard(state.equipment.stats)+activityCard(state.activity);

  all('[data-inspect]').forEach(node=>node.addEventListener('click',()=>{const label=node.querySelector('strong')?.textContent||node.title||node.dataset.inspect;setText('[data-selection]',`${label}: preview inspection is ready for manifest and reasoning bindings.`);}));
}

async function init(){
  try{
    const response=await fetch('./guardian-workspace-v1.preview.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`Preview state request failed: ${response.status}`);
    render(await response.json());
  }catch(error){
    console.error(error);
    setText('[data-preview-banner]',`Unable to load production preview: ${error.message}`);
  }
}

init();
