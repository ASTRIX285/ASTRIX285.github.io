import assert from 'node:assert/strict';
import {
  captureMatchesCharacter,
  mergeCaptureArchive,
  selectCandidateActivities,
  classifyCandidateEvidence,
  summarizeCaptureEvidence
} from '../pages/guardian-workspace-v2/guardian-shooting-range-evidence.mjs';

const armedAt='2026-08-22T20:00:00.000Z';
const before={instanceId:'100',period:'2026-08-22T19:59:00.000Z',referenceId:10,directorActivityHash:11};
const baseline={instanceId:'101',period:'2026-08-22T20:01:00.000Z',referenceId:20,directorActivityHash:21};
const newActivity={instanceId:'102',period:'2026-08-22T20:02:00.000Z',referenceId:30,directorActivityHash:31};

assert.equal(captureMatchesCharacter({characterId:'warlock-1'},'warlock-1'),true,'the capture may only match its exact Guardian');
assert.equal(captureMatchesCharacter({characterId:'warlock-1'},'titan-2'),false,'a different Guardian must not inherit the capture');
assert.equal(captureMatchesCharacter({characterId:'warlock-1'},''),false,'missing current Guardian identity must fail closed');

const archived=mergeCaptureArchive(
  [{testId:'PF-RANGE-2',status:'collected'},{testId:'PF-RANGE-1',status:'collected'}],
  {testId:'PF-RANGE-3',status:'armed'},
  2
);
assert.deepEqual(archived.map(row=>row.testId),['PF-RANGE-3','PF-RANGE-2'],'re-arming must retain the newest bounded raw capture history');
assert.deepEqual(
  mergeCaptureArchive(archived,{testId:'PF-RANGE-2',status:'collected'},5).map(row=>row.testId),
  ['PF-RANGE-2','PF-RANGE-3'],
  'archiving the same test must replace rather than duplicate it'
);

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

const failed=classifyCandidateEvidence({activity:newActivity,error:{status:404}});
assert.equal(failed.classification,'pgcr-unavailable');

const summary=summarizeCaptureEvidence([{evidence:verified},{evidence:failed}]);
assert.equal(summary.verifiedActivityPgcrCount,1);
assert.equal(summary.shootingRangeIdentified,false);

console.log('Shooting Range evidence classification tests passed.');
