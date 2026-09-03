import {recommendArtifactPerks} from '../guardian-artifact-recommender.mjs';
import {createIntendedArtifactConfiguration,protectBuildState} from './paradox-build-state.mjs';

const clone=value=>{
  try{return structuredClone(value);}
  catch{return JSON.parse(JSON.stringify(value??null));}
};
const integer=value=>value===null||value===undefined||value===''?null:(Number.isInteger(Number(value))?Number(value):null);
const hashOf=value=>integer(value?.hash??value?.itemHash??value?.bungieHash??value?.artifactHash);
const sortedHashes=values=>[...new Set((Array.isArray(values)?values:[]).map(integer).filter(value=>value!==null))].sort((a,b)=>a-b);

function recommendationFingerprint(build={},currentSeasonNumber=null){
  const artifact=build.artifact||{};
  return JSON.stringify({
    characterId:String(build.characterId||''),
    currentSeasonNumber:integer(currentSeasonNumber),
    artifactHash:hashOf(artifact),
    artifactSeason:integer(artifact.seasonNumber),
    pointsUsed:integer(artifact.pointsUsed),
    perks:(artifact.perks||[]).map(perk=>({hash:hashOf(perk),active:perk?.isActive===true,visible:perk?.isVisible===true,tierUnlocked:perk?.tierUnlocked===true})),
    forgeLoaderDecision:build.forgeLoaderDecision||null,
    subclass:build.subclass||build.subclassName||'',
    super:hashOf(build.subclassBuild?.super||build.super),
    abilities:(build.subclassBuild?.abilities||build.abilities||[]).map(hashOf),
    aspects:(build.subclassBuild?.aspects||build.aspects||[]).map(hashOf),
    fragments:(build.subclassBuild?.fragments||build.fragments||[]).map(hashOf),
    weapons:(build.weapons||[]).map(weapon=>({hash:hashOf(weapon),element:weapon?.element||weapon?.elementDefinition?.displayProperties?.name||'',type:weapon?.weaponType||weapon?.itemTypeDisplayName||weapon?.definition?.itemTypeDisplayName||''}))
  });
}

function currentSeasonOf(build={},override=null){
  return integer(override??build.currentSeasonNumber??build.currentSeason?.seasonNumber);
}

function applyForgeArtifactRecommendation(state,{currentSeasonNumber=null,force=false}={}){
  if(!state?.originalBuild||!state?.workingBuild||!state.workingBuild.forgeLoaderDecision){
    return {state,applied:false,recommendation:null};
  }
  const build=state.workingBuild;
  const season=currentSeasonOf(build,currentSeasonNumber);
  const artifact=build.artifact||null;
  const effectiveArtifact=artifact&&integer(artifact.seasonNumber)===null&&season!==null?{...artifact,seasonNumber:season}:artifact;
  const fingerprint=recommendationFingerprint({...build,artifact:effectiveArtifact},season);
  if(!force&&build.artifactRecommendation?.fingerprint===fingerprint){
    return {state,applied:false,recommendation:build.artifactRecommendation};
  }
  const recommendation={...recommendArtifactPerks(build,effectiveArtifact,{currentSeasonNumber:season}),fingerprint,userOverride:false,source:'paradox-forge-loader-artifact-fit'};
  const next=clone(state);
  next.workingBuild.currentSeasonNumber=season;
  next.workingBuild.artifactRecommendation=clone(recommendation);

  const completeSelection=recommendation.status==='current'
    && recommendation.selectionStatus==='ready'
    && recommendation.selectionLimit>0
    && recommendation.selectedPerkHashes.length===recommendation.selectionLimit
    && recommendation.selectedMatchedCount>0;
  if(!completeSelection)return {state:protectBuildState(next),applied:false,recommendation};

  const prior=build.artifactConfiguration||artifact?.artifactConfiguration||null;
  const configuration=createIntendedArtifactConfiguration(effectiveArtifact,prior);
  const selectedPerkHashes=sortedHashes(recommendation.selectedPerkHashes);
  next.workingBuild.artifactConfiguration={
    ...configuration,
    artifactHash:recommendation.artifactHash,
    seasonNumber:recommendation.seasonNumber,
    selectedPerkHashes,
    source:'paradox-forge-loader-recommendation',
    provenance:{
      provider:'paradox-forge',
      path:'workingBuild.artifactConfiguration',
      state:'recommended-working-build-only',
      derivedFrom:'workingBuild.forgeLoaderDecision',
      recommendationFingerprint:fingerprint,
      currentSeasonNumber:season,
      upstream:clone(prior?.provenance||artifact?.artifactConfiguration?.provenance||null)
    }
  };
  if(next.workingBuild.artifact){
    next.workingBuild.artifact.seasonNumber=integer(next.workingBuild.artifact.seasonNumber)??season;
    next.workingBuild.artifact.artifactConfiguration=clone(next.workingBuild.artifactConfiguration);
  }
  return {state:protectBuildState(next),applied:true,recommendation};
}

export {applyForgeArtifactRecommendation,currentSeasonOf,recommendationFingerprint};
