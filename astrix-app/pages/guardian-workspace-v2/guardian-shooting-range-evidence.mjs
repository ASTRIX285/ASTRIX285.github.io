const asString=value=>String(value??'').trim();
const positiveHash=value=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;

function periodAtOrAfterArmed(period,armedAt){
  const periodMs=Date.parse(asString(period));
  const armedMs=Date.parse(asString(armedAt));
  return Number.isFinite(periodMs)&&Number.isFinite(armedMs)&&periodMs>=armedMs-5000;
}

function selectCandidateActivities({activities=[],baselineInstanceIds=[],armedAt='',baselineAvailable=true}={}){
  const baseline=new Set((baselineInstanceIds||[]).map(asString).filter(Boolean));
  return (Array.isArray(activities)?activities:[])
    .filter(activity=>{
      const instanceId=asString(activity?.instanceId);
      if(!instanceId||!periodAtOrAfterArmed(activity?.period,armedAt))return false;
      return baselineAvailable?!baseline.has(instanceId):true;
    })
    .map(activity=>({
      ...activity,
      candidateBasis:baselineAvailable?'new-instance-after-baseline':'timestamp-only-baseline-unavailable',
      candidateConfidence:baselineAvailable?'corroborated':'limited'
    }));
}

function classifyCandidateEvidence({activity=null,pgcr=null,error=null}={}){
  const referenceId=positiveHash(activity?.referenceId);
  const directorActivityHash=positiveHash(activity?.directorActivityHash);
  const pgcrReferenceId=positiveHash(pgcr?.activityDetails?.referenceId);
  const pgcrDirectorActivityHash=positiveHash(pgcr?.activityDetails?.directorActivityHash);
  const hasHashIdentity=Boolean(referenceId&&directorActivityHash);
  const hasPgcr=Boolean(pgcr);
  const hashAgreement=hasHashIdentity&&Boolean(
    (!pgcrReferenceId||pgcrReferenceId===referenceId)&&
    (!pgcrDirectorActivityHash||pgcrDirectorActivityHash===directorActivityHash)
  );
  let classification='unproven-activity-candidate';
  if(error)classification='pgcr-unavailable';
  else if(hasPgcr&&!hasHashIdentity)classification='pgcr-without-activity-hash-identity';
  else if(hasPgcr&&!hashAgreement)classification='activity-pgcr-hash-mismatch';
  else if(hasPgcr&&hasHashIdentity&&hashAgreement)classification='verified-activity-pgcr-evidence';
  return {
    classification,
    shootingRangeIdentification:'unverified',
    proof:{
      hasInstanceId:Boolean(asString(activity?.instanceId)),
      hasReferenceId:Boolean(referenceId),
      hasDirectorActivityHash:Boolean(directorActivityHash),
      hasPgcr,
      hashAgreement
    }
  };
}

function summarizeCaptureEvidence(results=[]){
  const rows=Array.isArray(results)?results:[];
  return {
    candidateCount:rows.length,
    verifiedActivityPgcrCount:rows.filter(row=>row?.evidence?.classification==='verified-activity-pgcr-evidence').length,
    pgcrUnavailableCount:rows.filter(row=>row?.evidence?.classification==='pgcr-unavailable').length,
    shootingRangeIdentified:false,
    conclusion:rows.length
      ?'Activity candidates were collected. None may be labelled Shooting Range until a verified hash mapping proves the activity identity.'
      :'No post-arm activity candidate was found.'
  };
}

export {periodAtOrAfterArmed,selectCandidateActivities,classifyCandidateEvidence,summarizeCaptureEvidence};
