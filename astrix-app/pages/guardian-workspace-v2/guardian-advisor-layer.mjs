const CLASS_MARKS={
  hunter:`<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 22 42l18-5-9 25 19-13 19 13-9-25 18 5Z"/><path d="M50 49v42M31 62l19 29 19-29"/></svg>`,
  titan:`<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 82 27v46L50 92 18 73V27Z"/><path d="M50 8v84M18 27l64 46M82 27 18 73"/></svg>`,
  warlock:`<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34"/><path d="M50 14 62 40l24 10-24 10-12 26-12-26-24-10 24-10Z"/></svg>`
};

const DEFAULT_CONTEXT={
  characterClass:'hunter',subclass:'arc',exotic:'Shinobu\'s Vow',focus:'Skip Grenade loop',activity:'General PvE',
  recommendations:[
    {role:'Grenade amplification',reason:'Prioritise perks whose verified effect directly strengthens grenade damage or uptime.',state:'KEY FACTOR',kind:'key',icon:'◉'},
    {role:'Arc output',reason:'Prefer perks that turn Arc ability output into more damage, energy or targets.',state:'RECOMMENDED',kind:'',icon:'ϟ'},
    {role:'Weapon bridge',reason:'Use a verified Arc weapon perk only when it feeds the same grenade and jolt loop.',state:'SUPPORT',kind:'',icon:'⌖'},
    {role:'Encounter counter',reason:'Add the required champion or shield answer without breaking the core loop.',state:'ACTIVITY',kind:'counter',icon:'◆'},
    {role:'Super conversion',reason:'Select a super booster when the activity values burst more than sustained grenades.',state:'SWAP',kind:'swap',icon:'✦'},
    {role:'Survival layer',reason:'Use a defensive perk only when survivability is the measured weak link.',state:'OPTIONAL',kind:'swap',icon:'♥'}
  ],
  effects:[
    {name:'Skip Grenade loop',detail:'Exotic input → grenade output → recharge opportunity',score:'CORE',icon:'◉'},
    {name:'Arc chain pressure',detail:'Jolt and Arc output extend add-clear value',score:'HIGH',icon:'ϟ'},
    {name:'Weapon contribution',detail:'Weapon only qualifies when it feeds the ability rotation',score:'LINK',icon:'⌖'},
    {name:'Encounter coverage',detail:'Champion, surge and shield checks are applied outward',score:'CHECK',icon:'◆'}
  ]
};

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function ensureClassMark(context){
  const stage=document.querySelector('.stage');if(!stage)return;
  let mark=stage.querySelector('.stage-class-mark');
  if(!mark){mark=document.createElement('div');mark.className='stage-class-mark';stage.querySelector('.stage-backdrop')?.appendChild(mark)}
  mark.innerHTML=CLASS_MARKS[context.characterClass]||CLASS_MARKS.hunter;
}

function renderAdvisor(context=DEFAULT_CONTEXT){
  const artifactGroup=document.querySelector('.left .grp:last-child');
  if(!artifactGroup)return;
  let advisor=artifactGroup.querySelector('.artifact-advisor');
  if(!advisor){advisor=document.createElement('section');advisor.className='artifact-advisor';artifactGroup.appendChild(advisor)}
  const recs=Array.isArray(context.recommendations)?context.recommendations:DEFAULT_CONTEXT.recommendations;
  advisor.innerHTML=`<div class="artifact-advisor-head"><b>BUILD-SELECTED ENHANCEMENTS</b><span class="artifact-context">${escapeHtml(context.subclass)} ${escapeHtml(context.characterClass)} · ${escapeHtml(context.exotic||'No exotic selected')}</span></div><div class="artifact-grid">${recs.map(item=>`<article class="artifact-choice ${escapeHtml(item.kind||'')}"><div class="choice-top"><span class="choice-icon">${escapeHtml(item.icon||'◆')}</span><span class="choice-state">${escapeHtml(item.state||'RECOMMENDED')}</span></div><h4>${escapeHtml(item.role)}</h4><p>${escapeHtml(item.reason)}</p></article>`).join('')}</div><div class="artifact-chain"><b>${escapeHtml(context.exotic||'Selected exotic')}</b><i>→</i><span>${escapeHtml(context.focus||'Build loop')}</span><i>→</i><span>verified artifact roles</span><i>→</i><span>${escapeHtml(context.activity||'selected activity')}</span></div>`;

  let effects=document.querySelector('.left .effects-panel');
  if(!effects){effects=document.createElement('section');effects.className='effects-panel';document.querySelector('.left')?.appendChild(effects)}
  const effectRows=Array.isArray(context.effects)?context.effects:DEFAULT_CONTEXT.effects;
  effects.innerHTML=`<div class="effects-head"><b>BUILD EFFECTS</b><span>CAUSE → EFFECT</span></div><div class="effects-list">${effectRows.map(item=>`<div class="effect-row"><span class="effect-icon">${escapeHtml(item.icon||'◆')}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.detail)}</small></div><span class="effect-score">${escapeHtml(item.score||'')}</span></div>`).join('')}</div>`;
  ensureClassMark(context);
}

function normaliseContext(detail={}){
  return {...DEFAULT_CONTEXT,...detail,characterClass:String(detail.characterClass||detail.className||DEFAULT_CONTEXT.characterClass).toLowerCase(),subclass:String(detail.subclass||DEFAULT_CONTEXT.subclass).toLowerCase()};
}

document.addEventListener('astrix:artifact-recommendations-changed',event=>renderAdvisor(normaliseContext(event.detail)));
document.addEventListener('astrix:guardian-selection-changed',event=>renderAdvisor(normaliseContext(event.detail)));
renderAdvisor(DEFAULT_CONTEXT);
