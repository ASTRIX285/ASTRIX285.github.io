import assert from 'node:assert/strict';
import {
  selectCandidateActivities,
  activityMatchesExpectation,
  chooseCandidateActivity,
  classifyCandidateEvidence,
  summarizeCaptureEvidence
} from '../pages/guardian-workspace-v2/guardian-shooting-range-evidence.mjs';

const armedAt='2026-08-22T20:00:00.000Z';
const before={instanceId:'100',period:'2026-08-22T19:59:00.000Z',referenceId:10,directorActivityHash:11};
const baseline={instanceId:'101',period:'2026-08-22T20:01:00.000Z',referenceId:20,directorActivityHash:21};
const newActivity={instanceId:'102',period:'2026-08-22T20:02:00.000Z',referenceId:30,directorActivityHash:31};

assert.deepEqual(
  selectCandidateActivities({activities:[before,baseline,newActivity],baselineInstanceIds:['101'],armedAt,baselineAvailable:true}).map(row=>row.instanceId),
  ['102'],
  'baseline rows and pre-arm rows must not be candidates'
);

assert.deepEqual(
  selectCandidateActivities({activities:[before,newActivity],armedAt,baselineAvailable:false}).map(row=>row.instanceId),
  ['102'],
  'a failed baseline may only use timestamp-limited candidates'
);

const pgcr={activityDetails:{referenceId:30,directorActivityHash:31},entries:[]};
const verified=classifyCandidateEvidence({activity:newActivity,pgcr});
assert.equal(verified.classification,'verified-activity-pgcr-evidence');
assert.equal(verified.shootingRangeIdentification,'unverified');
assert.equal(verified.proof.hasPgcrHashIdentity,true);

const emptyPgcr=classifyCandidateEvidence({activity:newActivity,pgcr:{}});
assert.equal(emptyPgcr.classification,'pgcr-without-pgcr-hash-identity','an object without PGCR hash identity must never verify an activity');
assert.equal(emptyPgcr.proof.hashAgreement,false);

const partialPgcr=classifyCandidateEvidence({activity:newActivity,pgcr:{activityDetails:{referenceId:30}}});
assert.equal(partialPgcr.classification,'pgcr-without-pgcr-hash-identity','both PGCR identity hashes are required');

const mismatchedPgcr=classifyCandidateEvidence({activity:newActivity,pgcr:{activityDetails:{referenceId:30,directorActivityHash:999}}});
assert.equal(mismatchedPgcr.classification,'activity-pgcr-hash-mismatch','Activity History and PGCR hashes must agree exactly');

const failed=classifyCandidateEvidence({activity:newActivity,error:{status:404}});
assert.equal(failed.classification,'pgcr-unavailable');

const summary=summarizeCaptureEvidence([{evidence:verified},{evidence:failed}]);
assert.equal(summary.verifiedActivityPgcrCount,1);
assert.equal(summary.shootingRangeIdentified,false);

const pvpExpectation={activityTypeHash:777,mode:5};
const pvpExact={...newActivity,activityTypeHash:777,mode:5,modes:[5]};
assert.equal(activityMatchesExpectation(pvpExact,pvpExpectation),true,'verified activity type and mode hashes must match exactly');
assert.deepEqual(
  chooseCandidateActivity([{activity:pvpExact}],pvpExpectation),
  {status:'auto-selected-exact-match',selectedInstanceId:'102',requiresUserConfirmation:false,choices:[{activity:pvpExact}]},
  'one exact verified match may be selected automatically'
);
const ambiguous=chooseCandidateActivity([{activity:pvpExact},{activity:{...pvpExact,instanceId:'103'}}],pvpExpectation);
assert.equal(ambiguous.status,'user-confirmation-required');
assert.equal(ambiguous.requiresUserConfirmation,true,'multiple exact matches must remain under user control');

console.log('Shooting Range evidence classification tests passed.');
