const STATE_TOKENS = Object.freeze([
  'blind','devour','freeze','ignite','jolt','radiant','restoration','scorch','sever','slow','suspend','suppression','unravel','volatile','weaken',
  'ionic-trace','stasis-crystal','stasis-shard','tangle','threadling','orb-of-power',
  'grenade-energy','melee-energy','class-ability-energy','super-energy'
]);

const TRIGGER_TOKENS = Object.freeze([
  'precision-final-blow','rapid-final-blow','weapon-final-blow','reload','stow-ready','matching-element-final-blow','ability-final-blow','melee-final-blow','grenade-final-blow','orb-pickup','class-ability-use','super-cast','shield-break','critical-health','sustained-damage'
]);

const OBJECTIVES = Object.freeze([
  'survivability','ability-uptime','boss-damage','add-clear','champion-control','support','ammo-economy','solo','balanced'
]);

const ACTIVITY_TYPES = Object.freeze([
  'general-pve','vanguard-master-operation','nightfall','grandmaster-nightfall','dungeon','raid','onslaught','pvp'
]);

const CHAMPION_TYPES = Object.freeze(['barrier','overload','unstoppable']);
const TOKEN_SET = new Set([...STATE_TOKENS,...TRIGGER_TOKENS]);

function clone(value){
  try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}
}

function unique(rows){return [...new Set((Array.isArray(rows)?rows:[]).filter(Boolean))];}
function assertKnownTokens(rows,label){
  const values=unique(rows);
  const unknown=values.filter(token=>!TOKEN_SET.has(token));
  if(unknown.length)throw new Error(`${label} contains unknown Paradox token(s): ${unknown.join(', ')}`);
  return values;
}

function normalizeEvidenceNode(node={}){
  if(!node.id)throw new Error('Evidence node requires a stable id.');
  return {
    id:String(node.id),
    componentType:String(node.componentType||'unknown'),
    bungieHash:Number.isFinite(Number(node.bungieHash))?Number(node.bungieHash):null,
    name:String(node.name||node.id),
    emits:assertKnownTokens(node.emits,'emits'),
    consumes:assertKnownTokens(node.consumes,'consumes'),
    triggers:assertKnownTokens(node.triggers,'triggers'),
    conditions:unique(node.conditions),
    verified:node.verified===true,
    sources:clone(node.sources||[])
  };
}

function directedEdges(nodes=[]){
  const normalized=nodes.map(normalizeEvidenceNode);
  const edges=[];
  normalized.forEach(emitter=>{
    emitter.emits.forEach(token=>{
      normalized.forEach(consumer=>{
        if(emitter.id===consumer.id)return;
        if(!consumer.consumes.includes(token))return;
        edges.push({from:emitter.id,to:consumer.id,token,verified:emitter.verified&&consumer.verified});
      });
    });
  });
  return edges;
}

function normalizeLocks(locks={}){
  return {
    subclass:Boolean(locks.subclass),
    super:Boolean(locks.super),
    abilities:clone(locks.abilities||{}),
    aspects:clone(locks.aspects||{}),
    fragments:clone(locks.fragments||{}),
    artifact:clone(locks.artifact||{}),
    weapons:clone(locks.weapons||{}),
    armour:clone(locks.armour||{}),
    exotic:Boolean(locks.exotic)
  };
}

function normalizeScenario(input={}){
  const objective=OBJECTIVES.includes(input.objective)?input.objective:'balanced';
  const activityType=ACTIVITY_TYPES.includes(input.activityType)?input.activityType:'general-pve';
  const champions=unique(input.champions).filter(type=>CHAMPION_TYPES.includes(type));
  return {
    scenarioVersion:1,
    scenarioId:String(input.scenarioId||`PF-SCENARIO-${Date.now()}`),
    buildSource:String(input.buildSource||'current-guardian'),
    objective,
    activity:{
      type:activityType,
      champions,
      surges:unique(input.surges),
      threats:unique(input.threats),
      modifiers:unique(input.modifiers)
    },
    locks:normalizeLocks(input.locks||{}),
    requiredCounters:unique(input.requiredCounters),
    evidenceNodes:(input.evidenceNodes||[]).map(normalizeEvidenceNode)
  };
}

function analyzeScenario(input={}){
  const scenario=normalizeScenario(input);
  const edges=directedEdges(scenario.evidenceNodes);
  const emitters=new Set(edges.map(edge=>edge.from));
  const consumers=new Set(edges.map(edge=>edge.to));
  const isolated=scenario.evidenceNodes.filter(node=>!emitters.has(node.id)&&!consumers.has(node.id)).map(node=>node.id);
  const unverifiedEdges=edges.filter(edge=>!edge.verified);
  return {scenario,edges,isolated,unverifiedEdges};
}

export {STATE_TOKENS,TRIGGER_TOKENS,OBJECTIVES,ACTIVITY_TYPES,CHAMPION_TYPES,normalizeEvidenceNode,directedEdges,normalizeLocks,normalizeScenario,analyzeScenario};