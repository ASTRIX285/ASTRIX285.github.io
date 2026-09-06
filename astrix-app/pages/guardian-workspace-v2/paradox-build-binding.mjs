const HANDOFF_SCHEMA=2;
const HANDOFF_TTL_MS=30*60*1000;

function bindingOf(value={}){
  const source=value?.originalBuild||value;
  return {
    membershipId:String(source?.membershipId||source?.bungieMembershipId||source?.membership?.membershipId||''),
    membershipType:String(source?.membershipType||source?.membership?.membershipType||''),
    characterId:String(source?.characterId||'')
  };
}

function bindingsEqual(left={},right={}){
  const a=bindingOf(left),b=bindingOf(right);
  return a.characterId===b.characterId&&a.membershipId===b.membershipId&&a.membershipType===b.membershipType;
}

function shouldReplaceBuildState(currentState,detail={},options={}){
  if(detail?.source!=="bungie-live"||!detail.characterId)return false;
  if(!currentState?.originalBuild||!currentState?.workingBuild)return true;
  const incomingCharacterId=String(detail.characterId||'');
  const explicitlySelectedCharacterId=String(options.explicitlySelectedCharacterId||'');
  const explicitCharacterChange=Boolean(explicitlySelectedCharacterId)&&explicitlySelectedCharacterId===incomingCharacterId;
  const explicitLoadoutChange=Number.isInteger(detail.selectedLoadoutIndex);
  if(explicitCharacterChange||explicitLoadoutChange)return true;
  // Automatic profile hydration must never replace an existing protected
  // Working Build. Only an explicit character or Bungie-slot selection may do
  // that; relying on a transient route query loses the build after hydration.
  return false;
}

function repairMissingBuildBinding(currentState,detail={}){
  if(!currentState?.originalBuild||!currentState?.workingBuild)return currentState;
  const current=bindingOf(currentState),incoming=bindingOf(detail);
  if(!current.characterId||current.characterId!==incoming.characterId)return currentState;
  if(current.membershipId&&current.membershipId!==incoming.membershipId)return currentState;
  if(current.membershipType&&current.membershipType!==incoming.membershipType)return currentState;
  const membershipId=current.membershipId||incoming.membershipId,membershipType=current.membershipType||incoming.membershipType;
  if(!membershipId||!membershipType||(membershipId===current.membershipId&&membershipType===current.membershipType))return currentState;
  const bind=build=>({...build,membershipId,membershipType});
  return {...currentState,originalBuild:bind(currentState.originalBuild),workingBuild:bind(currentState.workingBuild)};
}

function createHandoffEnvelope(payload,{savedAt=Date.now()}={}){
  return {schemaVersion:HANDOFF_SCHEMA,savedAt,binding:bindingOf(payload),payload};
}

function validateHandoffEnvelope(envelope,{expectedCharacterId='',expectedMembershipId='',expectedMembershipType='',allowLegacy=false,now=Date.now()}={}){
  if(!envelope||typeof envelope!=='object')return null;
  if(envelope.schemaVersion!==HANDOFF_SCHEMA)return allowLegacy&&envelope.characterId?envelope:null;
  if(!envelope.payload||now-Number(envelope.savedAt||0)>HANDOFF_TTL_MS)return null;
  const binding=bindingOf(envelope.binding),payloadBinding=bindingOf(envelope.payload);
  if(!binding.characterId||!bindingsEqual(binding,payloadBinding))return null;
  if(expectedCharacterId&&binding.characterId!==String(expectedCharacterId))return null;
  if(expectedMembershipId&&binding.membershipId!==String(expectedMembershipId))return null;
  if(expectedMembershipType&&binding.membershipType!==String(expectedMembershipType))return null;
  return envelope.payload;
}

export {HANDOFF_SCHEMA,HANDOFF_TTL_MS,bindingOf,bindingsEqual,shouldReplaceBuildState,repairMissingBuildBinding,createHandoffEnvelope,validateHandoffEnvelope};
