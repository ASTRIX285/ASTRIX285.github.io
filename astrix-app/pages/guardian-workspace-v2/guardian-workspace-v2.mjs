const byId=id=>document.getElementById(id);
const text=(id,value)=>{const el=byId(id);if(el)el.textContent=value??'';};
const image=(id,url,alt='')=>{const el=byId(id);if(!el)return;el.src=url||'';el.alt=alt;el.hidden=!url;};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function tile(item,meta=''){
  const icon=item.iconUrl?`<img src="${esc(item.iconUrl)}" alt="${esc(item.name)}">`:'';
  return `<button class="tile${item.equipped?' equipped':''}" type="button" data-name="${esc(item.name)}" data-description="${esc(item.description||meta)}">${icon}<strong>${esc(item.name)}</strong><small>${esc(meta)}</small></button>`;
}
function meters(items=[]){return items.map(x=>`<div class="meter"><label>${esc(x.label)}</label><span class="meter-track"><i style="width:${Math.min(100,Number(x.value)||0)}%"></i></span><b>${esc(x.value)}%</b></div>`).join('');}
function weapon(item){return `<article class="dock-card weapon-card"><h3>${esc(item.slot)}</h3><div class="dock-main"><span class="dock-image"></span><div><strong>${esc(item.name)}</strong><small>${esc(item.type)}</small><b>${esc(item.power||'Preview')} / 550</b></div></div></article>`;}
function armour(items=[]){return `<article class="dock-card armour-card"><h3>Armour</h3><div class="armour-dock">${items.map(item=>`<button class="armour-dock-item" type="button" data-name="${esc(item.name)}" data-description="${esc(item.slot)}"><span>${esc(item.shortLabel)}</span><small>${esc(item.slot)}</small></button>`).join('')}</div></article>`;}
function stats(items=[]){return `<article class="dock-card"><h3>Stats <small>CAP 200</small></h3>${items.map(x=>`<div class="stat-row"><span>${esc(x.name)}</span><span class="stat-track"><i style="width:${Math.min(100,(Number(x.value)||0)/2)}%"></i></span><b>${esc(x.value)}</b></div>`).join('')}</article>`;}
function mods(){return `<article class="dock-card"><h3>Armour Mods</h3><div class="mods-grid">${Array.from({length:8},()=>'<div class="mod-box">◇</div>').join('')}</div></article>`;}
function activity(a){return `<article class="dock-card"><h3>Activity</h3><strong>${esc(a.name)}</strong><p>Champions: ${esc(a.champions.join(', '))}<br>Surge: ${esc(a.surge)}</p></article>`;}

function render(data){
  document.documentElement.style.setProperty('--accent',data.theme.accent);
  document.documentElement.style.setProperty('--accent-rgb',data.theme.accentRgb);
  text('preview-note',data.notice);text('account-name',`${data.player.displayName}#${data.player.membershipCode}`);
  text('subclass-name',data.subclass.name);text('subclass-meta',`${data.character.className} · ${data.subclass.element.name}`);
  text('power',data.character.power??'Preview');text('stage-power',data.character.power??'Preview');
  text('guardian-name',data.player.displayName);text('guardian-meta',`${data.character.className} · ${data.subclass.name}`);
  text('guardian-rank',data.character.guardianRank??'Preview');text('triumph-score',data.character.triumphScore??'Preview');
  text('emblem-name',data.character.emblemName||'Not connected');text('title-ribbon',data.character.title||'GUARDIAN');
  image('subclass-crest',data.subclass.element.crestUrl,`${data.subclass.element.name} crest`);image('fallback-crest',data.subclass.element.crestUrl,`${data.subclass.element.name} crest`);
  const guardian=byId('guardian-render'),fallback=byId('guardian-fallback');
  if(guardian&&fallback){guardian.hidden=!data.character.renderUrl;fallback.hidden=Boolean(data.character.renderUrl);if(data.character.renderUrl)guardian.src=data.character.renderUrl;}
  byId('supers').innerHTML=data.subclass.supers.map(x=>tile(x,x.equipped?'Equipped':'Available')).join('');
  byId('abilities').innerHTML=data.subclass.abilities.map(x=>tile(x,x.slot)).join('');
  byId('aspects').innerHTML=data.subclass.aspects.map(x=>tile(x,`${x.fragmentSlots||0} fragment slots`)).join('');
  byId('fragments').innerHTML=data.subclass.fragments.map(x=>tile(x,x.statText)).join('');
  byId('artifact').innerHTML=data.subclass.artifact.perks.map(x=>tile({...x,equipped:x.active},x.active?'Active':'Unlocked')).join('');
  text('aspect-count',`${data.subclass.aspects.filter(x=>x.equipped).length} / ${data.subclass.aspects.length}`);
  text('fragment-count',`${data.subclass.fragments.filter(x=>x.equipped).length} / ${data.subclass.fragments.length}`);
  const armourStack=byId('armour-stack');if(armourStack)armourStack.innerHTML='';
  text('build-score',data.analysis.buildScore);text('health-grade',data.analysis.health.grade);text('health-label',data.analysis.health.label);text('health-summary',data.analysis.health.summary);
  byId('measures').innerHTML=meters(data.analysis.measures);
  byId('coverage').innerHTML=data.analysis.coverage.map(x=>`<div class="coverage-row"><span>${esc(x.label)}</span><strong class="${x.covered?'covered':'missing'}">${x.covered?'✓ Covered':'✕ Missing'}</strong></div>`).join('');
  text('loop-summary',data.analysis.loopSummary);
  byId('loop-path').innerHTML=data.analysis.primaryLoop.nodes.map((x,i)=>`${i?'<span class="path-arrow">→</span>':''}<button class="path-node" type="button" data-name="${esc(x)}" data-description="Directed build-loop step">${esc(x)}</button>`).join('');
  byId('strengths').innerHTML=data.analysis.strengths.map(x=>`<div class="insight">${esc(x)}</div>`).join('');
  byId('weaknesses').innerHTML=data.analysis.weaknesses.map(x=>`<div class="insight">${esc(x)}</div>`).join('');
  byId('recommendations').innerHTML=data.analysis.recommendations.map(x=>`<article class="recommendation"><strong>${esc(x.title)}</strong><p>${esc(x.reason)}</p></article>`).join('');
  byId('activity').innerHTML=`<strong>${esc(data.activity.name)}</strong><p>Champions: ${esc(data.activity.champions.join(', '))}<br>Surge: ${esc(data.activity.surge)}</p>`;
  byId('bottom-dock').innerHTML=`<div class="weapon-group">${data.equipment.weapons.map(weapon).join('')}</div>${armour(data.equipment.armour)}${stats(data.equipment.stats)}${mods()}${activity(data.activity)}`;
  document.querySelectorAll('[data-name]').forEach(el=>el.addEventListener('click',()=>text('inspection',`${el.dataset.name}: ${el.dataset.description||'Ready for analysis.'}`)));
}

fetch('./guardian-workspace-v2.preview.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Preview request failed: ${r.status}`);return r.json();}).then(render).catch(error=>{console.error(error);text('preview-note',`Unable to load Guardian Workspace v2: ${error.message}`);});