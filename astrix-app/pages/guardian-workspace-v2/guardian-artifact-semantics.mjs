/* ASTRIX PARADOX — Artifact semantic coverage.
 * Bungie character progression is authoritative for applied state.
 */

const hasDefinition=item=>Boolean(item?.definition&&Object.keys(item.definition).length);

function classifyArtifact(artifact){
  if(!artifact)return null;
  const all=Array.isArray(artifact.perks)?artifact.perks:[];
  const applied=Array.isArray(artifact.activePerks)?artifact.activePerks:all.filter(item=>item?.isActive===true);
  const visible=all.filter(item=>item?.isVisible!==false);
  const unresolvedApplied=applied.filter(item=>!hasDefinition(item));
  return {
    hash:Number.isFinite(Number(artifact.hash))?Number(artifact.hash):null,
    name:String(artifact.name||''),
    appliedPerks:applied,
    visiblePerks:visible,
    appliedCount:applied.length,
    expectedAppliedCount:7,
    unresolvedAppliedHashes:unresolvedApplied.map(item=>Number(item.hash)).filter(Number.isFinite),
    definitionsComplete:unresolvedApplied.length===0,
    sevenOfSeven:applied.length===7,
    complete:applied.length===7&&unresolvedApplied.length===0,
    coverage:artifact.coverage||null
  };
}

function enrichArtifactSemantics(detail){
  if(!detail||typeof detail!=='object')return detail;
  detail.semanticArtifact=classifyArtifact(detail.artifact);
  detail.semanticCoverage=detail.semanticCoverage||{};
  detail.semanticCoverage.artifact=detail.semanticArtifact?{
    appliedCount:detail.semanticArtifact.appliedCount,
    unresolvedAppliedHashes:detail.semanticArtifact.unresolvedAppliedHashes,
    complete:detail.semanticArtifact.complete
  }:null;
  return detail;
}

if(typeof document!=='undefined'){
  document.addEventListener('astrix:guardian-selection-changed',event=>enrichArtifactSemantics(event.detail));
}

export {classifyArtifact,enrichArtifactSemantics};
