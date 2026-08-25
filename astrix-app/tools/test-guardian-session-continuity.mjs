import assert from 'node:assert/strict';
import {
  SESSION_CACHE_MAX_AGE_MS,
  createSessionCacheEnvelope,
  readReusableSession,
  guardianReturnMode
} from '../pages/guardian-workspace-v2/guardian-session-continuity.mjs';

const now=1_800_000_000_000;
const session={
  authenticated:true,
  bungieMembershipId:'bungie-1',
  destinyMemberships:[{membershipId:'destiny-1',membershipType:3,displayName:'ASTRIX IX'}],
  primaryMembershipId:'destiny-1',
  activeDestinyMembership:{membershipId:'destiny-1',membershipType:3,displayName:'ASTRIX IX'},
  accessExpiresAt:now+10*60*1000,
  accessToken:'must-not-be-cached'
};
const envelope=createSessionCacheEnvelope(session,{now});
assert.ok(envelope,'authenticated session creates a reusable session envelope');
assert.equal(envelope.session.accessToken,undefined,'OAuth access tokens must never enter browser session storage');
assert.equal(readReusableSession(JSON.stringify(envelope),{now}).activeDestinyMembership.membershipId,'destiny-1');
assert.equal(readReusableSession(envelope,{now:now+SESSION_CACHE_MAX_AGE_MS+1}),null,'stale navigation cache is rejected');
assert.equal(readReusableSession(envelope,{now:session.accessExpiresAt-30_000}),null,'near-expiry session cache is rejected');
assert.equal(createSessionCacheEnvelope({authenticated:false},{now}),null,'signed-out state is not cached');

const guardianUrl='https://astrixparadox.com/astrix-app/pages/guardian-workspace-v2/';
const buildUrl=guardianUrl+'paradox-build-space/';
assert.equal(guardianReturnMode({referrer:guardianUrl,currentUrl:buildUrl,historyLength:3}),'history','same-session Character to Build return restores browser history');
assert.equal(guardianReturnMode({referrer:guardianUrl+'index.html',currentUrl:buildUrl,historyLength:2}),'history');
assert.equal(guardianReturnMode({referrer:'https://example.com/',currentUrl:buildUrl,historyLength:3}),'navigate','cross-origin referrer cannot restore app history');
assert.equal(guardianReturnMode({referrer:'',currentUrl:buildUrl,historyLength:1}),'navigate','direct Build entry uses the explicit Character fallback');

console.log('Guardian session continuity tests passed.');
