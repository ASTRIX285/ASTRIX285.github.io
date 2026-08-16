// demo-counter-engine.mjs
//
// Runs the counter engine against the real catalogue + counter rules for two
// contrasting encounters, asserts the expected coverage states, and prints the
// full result. Mirrors demo-synergy-engine.mjs: load JSON, run, assert, log.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  analyzeEncounterCoverage,
  CHAMPION_FRAME_LIMITATION
} from '../counter-engine.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(toolDirectory, '..', 'data', 'armor-3-components.json');
const rulesPath = path.resolve(toolDirectory, '..', 'data', 'counter-rules.json');

function entry(result, threat, subject) {
  return result.coverage.find((c) => c.threat === threat && c.subject === subject);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [catalogue, counterRules] = await Promise.all([
  readFile(cataloguePath, 'utf8').then(JSON.parse),
  readFile(rulesPath, 'utf8').then(JSON.parse)
]);

// A representative Void Warlock build. Only class + element drive surge/shield
// coverage; component ids are included to exercise the id-collection path.
const voidWarlock = {
  id: 'warlock-void-nova-control',
  class: 'Warlock',
  subclass: 'Void',
  element: 'Void',
  aspectIds: ['aspect-chaos-accelerant', 'aspect-feed-the-void'],
  exoticArmor: { id: 'exotic-nothing-manacles', name: 'Nothing Manacles' }
};

// Encounter 1 — a demanding week: two champions, Void surge, Solar shields, Match Game on.
const demandingEncounter = {
  champions: ['Barrier', 'Overload'],
  surge: 'Void',
  shields: ['Solar'],
  matchGame: true
};

// Encounter 2 — a favourable week: Void shields, Solar surge, no champions, no Match Game.
const favourableEncounter = {
  shields: ['Void'],
  surge: 'Solar',
  matchGame: false
};

const demanding = analyzeEncounterCoverage({
  build: voidWarlock,
  encounter: demandingEncounter,
  catalogue,
  counterRules
});

const favourable = analyzeEncounterCoverage({
  build: voidWarlock,
  encounter: favourableEncounter,
  catalogue,
  counterRules
});

// ---- assertions -----------------------------------------------------------

// Demanding week: champions unresolved (frame table absent), surge aligned, shield gap.
assert(demanding.status === 'partial', 'Demanding encounter should be partial (blocking required threats).');
assert(entry(demanding, 'champion', 'Barrier').state === 'unresolved', 'Barrier should be unresolved.');
assert(entry(demanding, 'champion', 'Overload').state === 'unresolved', 'Overload should be unresolved.');
assert(entry(demanding, 'surge', 'Void').state === 'aligned', 'Void surge should be aligned to a Void build.');
assert(entry(demanding, 'shield', 'Solar').state === 'gap', 'Solar shield should be a gap for a Void build.');
assert(entry(demanding, 'shield', 'Solar').requirement === 'required', 'Solar shield should be required under Match Game.');
assert(demanding.limitations.includes(CHAMPION_FRAME_LIMITATION), 'Champion limitation must be surfaced.');
assert(demanding.gaps.length === 3, 'Demanding week should list 3 blocking gaps (2 champions + 1 shield).');

// Every asserted coverage state must carry the rule's reasoning (surge/shield) so
// the "why" is never blank where a rule exists.
assert(typeof entry(demanding, 'surge', 'Void').reasoning === 'string', 'Surge coverage must carry reasoning.');
assert(typeof entry(demanding, 'shield', 'Solar').reasoning === 'string', 'Shield coverage must carry reasoning.');

// Favourable week: matching shield covered, no blocking required threats => ready.
assert(favourable.status === 'ready', 'Favourable encounter should be ready.');
assert(entry(favourable, 'shield', 'Void').state === 'covered', 'Void shield should be covered by a Void build.');
assert(entry(favourable, 'shield', 'Void').requirement === 'recommended', 'Void shield should be recommended (no Match Game).');
assert(entry(favourable, 'surge', 'Solar').state === 'misaligned', 'Solar surge should be misaligned for a Void build (optimisation, non-blocking).');
assert(favourable.gaps.length === 0, 'Favourable week should have no blocking gaps.');

console.log(JSON.stringify({ demanding, favourable }, null, 2));
