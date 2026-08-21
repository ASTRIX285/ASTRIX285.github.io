const BUILD_STATE_VERSION = 1;
const VALIDATION_STATUS = Object.freeze({
  UNTESTED:'untested',
  INITIAL:'initial-result',
  PROVISIONAL:'provisionally-validated',
  REPEATED:'repeatedly-validated',
  INVALIDATED:'not-validated'
});

function clone(value){
  try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}
}

function freezeDeep(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);
  Object.values(value).forEach(freezeDeep);
  return value;
}

function itemIdentity(item){
  if(!item)return null;
  return String(item.itemInstanceId||item.instanceId||item.hash||item.bungieHash||item.name||'');
}

function normalizeBuild(build={}){
  return {
    ...clone(build),
    version:BUILD_STATE_VERSION,
    characterId:String(build.characterId||''),
    selectedLoadoutIndex:Number.isInteger(build.selectedLoadoutIndex)?build.selectedLoadoutIndex:null,
    subclassBuild:clone(build.subclassBuild||{}),
    artifact:clone(build.artifact||null),
    weapons:Array.isArray(build.weapons)?clone(build.weapons):[],
    armour:Array.isArray(build.armour)?clone(build.armour):[],
    stats:Array.isArray(build.stats)?clone(build.stats):[],
    locks:clone(build.locks||{}),
    objective:build.objective||null,
    activityContext:clone(build.activityContext||null)
  };
}

function createBuildState(sourceBuild){
  const normalized=normalizeBuild(sourceBuild||{});
  const original=freezeDeep(clone(normalized));
  return {
    version:BUILD_STATE_VERSION,
    createdAt:new Date().toISOString(),
    originalBuild:original,
    workingBuild:clone(normalized),
    recommendation:null,
    validationRecords:[]
  };
}

function diffSlot(prefix,before,after,index){
  const a=itemIdentity(before);
  const b=itemIdentity(after);
  if(a===b)return null;
  return {path:`${prefix}.${index}`,before:clone(before),after:clone(after),beforeId:a,afterId:b};
}

function diffBuilds(original={},working={}){
  const changes=[];
  const scalarPaths=['subclass','subclassName'];
  scalarPaths.forEach(path=>{
    if(String(original?.[path]??'')!==String(working?.[path]??''))changes.push({path,before:original?.[path]??null,after:working?.[path]??null});
  });

  const originalBuild=original.subclassBuild||{};
  const workingBuild=working.subclassBuild||{};
  const originalSuper=itemIdentity(originalBuild.super);
  const workingSuper=itemIdentity(workingBuild.super);
  if(originalSuper!==workingSuper)changes.push({path:'subclassBuild.super',before:clone(originalBuild.super),after:clone(workingBuild.super),beforeId:originalSuper,afterId:workingSuper});

  ['abilities','aspects','fragments'].forEach(key=>{
    const left=Array.isArray(originalBuild[key])?originalBuild[key]:[];
    const right=Array.isArray(workingBuild[key])?workingBuild[key]:[];
    const count=Math.max(left.length,right.length);
    for(let i=0;i<count;i+=1){const change=diffSlot(`subclassBuild.${key}`,left[i],right[i],i);if(change)changes.push(change);}
  });

  for(const key of ['weapons','armour']){
    const left=Array.isArray(original[key])?original[key]:[];
    const right=Array.isArray(working[key])?working[key]:[];
    const count=Math.max(left.length,right.length);
    for(let i=0;i<count;i+=1){const change=diffSlot(key,left[i],right[i],i);if(change)changes.push(change);}
  }

  const beforePerks=Array.isArray(original.artifact?.activePerks)?original.artifact.activePerks:[];
  const afterPerks=Array.isArray(working.artifact?.activePerks)?working.artifact.activePerks:[];
  const perkCount=Math.max(beforePerks.length,afterPerks.length);
  for(let i=0;i<perkCount;i+=1){const change=diffSlot('artifact.activePerks',beforePerks[i],afterPerks[i],i);if(change)changes.push(change);}
  return changes;
}

function createValidationRecord({build,testId=null,targetActivity='Vanguard Master Operation',objective=null}={}){
  const snapshot=normalizeBuild(build||{});
  return {
    schemaVersion:1,
    testId:testId||`PF-TEST-${Date.now()}`,
    createdAt:new Date().toISOString(),
    status:VALIDATION_STATUS.UNTESTED,
    targetActivity,
    objective:objective||snapshot.objective||null,
    characterId:snapshot.characterId,
    selectedLoadoutIndex:snapshot.selectedLoadoutIndex,
    buildSnapshot:freezeDeep(clone(snapshot)),
    activityInstanceId:null,
    pgcr:null,
    buildIntegrity:'unverified',
    baseline:null,
    outcome:null
  };
}

export {BUILD_STATE_VERSION,VALIDATION_STATUS,clone,freezeDeep,itemIdentity,normalizeBuild,createBuildState,diffBuilds,createValidationRecord};