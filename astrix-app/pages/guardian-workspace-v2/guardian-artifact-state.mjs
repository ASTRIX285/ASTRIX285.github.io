const num=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
const itemHash=item=>num(item?.hash??item?.bungieHash??item?.itemHash);

function normalisePerks(rows=[]){
  return (Array.isArray(rows)?rows:[]).map(item=>({...item,hash:itemHash(item)})).filter(item=>item.hash!==null);
}

function resolveArtifactViewState(detail={},fallback={}){
  const source=String(detail?.source||'').toLowerCase();
  const liveArtifact=detail?.artifact||null;
  const liveMode=source==='bungie-live'||source==='bungie-loadout'||source==='bungie-selected-loadout';

  if(liveMode&&liveArtifact){
    const state=String(liveArtifact.state||'state-unavailable');
    const all=normalisePerks(liveArtifact.perks||[]);
    const explicit=normalisePerks(liveArtifact.activePerks||[]);
    const active=state==='state-unavailable'?[]:(explicit.length?explicit:all.filter(item=>item?.isActive===true));
    return {
      mode:'live',
      state,
      editable:false,
      artifact:{...liveArtifact,hash:itemHash(liveArtifact)},
      perks:active,
      selectedHashes:state==='state-unavailable'?null:active.map(item=>item.hash),
      allPerks:all,
      artifactConfiguration:detail?.artifactConfiguration||liveArtifact.artifactConfiguration||null,
      source
    };
  }

  const fixtureArtifact=fallback.fixtureArtifact||null;
  const fixtureSelected=(fallback.fixtureSelected||[]).map(num).filter(value=>value!==null);
  return {
    mode:'fixture',
    state:'intended',
    editable:true,
    artifact:fixtureArtifact?{...fixtureArtifact,hash:itemHash(fixtureArtifact)}:null,
    perks:[],
    selectedHashes:Array.isArray(detail?.artifactConfiguration?.selectedPerkHashes)?detail.artifactConfiguration.selectedPerkHashes:fixtureSelected,
    allPerks:[],
    artifactConfiguration:detail?.artifactConfiguration||null,
    source:source||'fixture'
  };
}

export {resolveArtifactViewState};
