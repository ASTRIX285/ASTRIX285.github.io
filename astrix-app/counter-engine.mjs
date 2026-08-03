// counter-engine.mjs
//
// The encounter-coverage layer of Paradox Forge.
//
// Where synergy-engine.mjs reasons INWARD (does this build's own chain hold
// together?), the counter engine reasons OUTWARD: given a build and THIS week's
// encounter (its champions, surge and shields), which threats does the build
// already answer, which are gaps, and — critically — WHY. It is the same
// directed-synergy idea pointed at the activity instead of the loadout.
//
// It consumes counter-rules.json (the source-backed threat -> counter rules) and
// never asserts coverage from an unverified counter. Like the composer, it is
// deliberately honest about what it cannot yet resolve: champion coverage in the
// Monument of Triumph "Anti-Champion 2.0" sandbox is intrinsic to weapon frames,
// and until the weapon-frame table is catalogued the engine reports champions as
// UNRESOLVED rather than guessing.

const COUNTER_ENGINE_VERSION = '0.1.0';

const VALID_CLASSES = new Set(['Hunter', 'Titan', 'Warlock']);
const DAMAGE_ELEMENTS = new Set(['Arc', 'Solar', 'Void', 'Stasis', 'Strand']);
const CHAMPION_SUBJECTS = new Set(['Barrier', 'Overload', 'Unstoppable']);

// Honest, reusable limitation strings (mirrors the composer's COVERAGE/STAT
// limitation pattern).
const CHAMPION_FRAME_LIMITATION =
  'Champion counters in Monument of Triumph (Anti-Champion 2.0) are intrinsic to weapon frames, not artifact mods or subclass verbs. This engine cannot confirm champion coverage yet because the weapon-frame -> champion-type table is not catalogued; champions are reported UNRESOLVED, not guessed.';
const WEAPON_ELEMENT_LIMITATION =
  'Surge and shield coverage is currently assessed from the build subclass element only. Weapon-level element coverage requires curated notable-weapon data, which is not yet catalogued, so a build may cover a shield via a weapon this engine cannot see.';

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalize(value) {
  return String(value ?? '').trim();
}

function article(word) {
  return /^[aeiou]/i.test(normalize(word)) ? 'an' : 'a';
}

function titleCaseElement(value) {
  const v = normalize(value).toLowerCase();
  return v ? v[0].toUpperCase() + v.slice(1) : '';
}

// The build subclass element, used for surge/shield element matching.
function buildElement(build) {
  return titleCaseElement(build?.element ?? build?.subclass ?? '');
}

// Gather every component id the build actually contains, from either a build
// record (armor-3-builds.json) or a composeBuildFromExotic() result. Defensive:
// unknown shapes simply contribute nothing.
function collectBuildComponentIds(build) {
  const ids = new Set();
  const push = (value) => {
    if (isNonEmptyText(value)) ids.add(value);
  };
  const pushAll = (arr) => {
    if (Array.isArray(arr)) arr.forEach(push);
  };

  if (!build || typeof build !== 'object') return ids;

  pushAll(build.aspectIds);
  pushAll(build.fragmentIds);
  pushAll(build.componentIds);
  pushAll(build.subclassSetup?.aspectIds);
  push(build.exoticId);
  push(build.exotic?.id);
  push(build.exoticArmor?.id);

  // composeBuildFromExotic() shape
  const composition = build.composition;
  if (composition && typeof composition === 'object') {
    for (const section of [composition.aspects, composition.fragments, composition.artifactPerks]) {
      if (isNonEmptyArray(section?.selections)) {
        section.selections.forEach((selection) => {
          push(selection.componentId);
          pushAll(selection.componentIds);
        });
      }
    }
    push(composition.setBonus?.selection?.componentId);
  }

  return ids;
}

// Only verified counters can assert coverage. Unverified counters (e.g. the
// legacy subclass-verb champion mappings still awaiting MoT re-verification) are
// surfaced as hints but never flip a threat to "covered".
function verifiedCounters(rule) {
  return isNonEmptyArray(rule?.counters)
    ? rule.counters.filter((counter) => counter.verified === true)
    : [];
}

function unverifiedCounters(rule) {
  return isNonEmptyArray(rule?.counters)
    ? rule.counters.filter((counter) => counter.verified !== true)
    : [];
}

function indexRulesByThreat(counterRules) {
  const map = new Map();
  if (isNonEmptyArray(counterRules?.rules)) {
    for (const rule of counterRules.rules) {
      map.set(`${normalize(rule.threat)}:${normalize(rule.subject)}`, rule);
    }
  }
  return map;
}

function componentName(componentsById, componentRef) {
  const component = componentsById.get(componentRef);
  return component?.name ?? null;
}

function validateInput({ build, encounter, catalogue, counterRules }) {
  const errors = [];

  if (!build || typeof build !== 'object') {
    errors.push('build must be an object.');
  } else {
    if (!VALID_CLASSES.has(build.class)) {
      errors.push('build.class must be Hunter, Titan or Warlock.');
    }
    if (!isNonEmptyText(buildElement(build))) {
      errors.push('build.element or build.subclass is required.');
    }
  }

  if (!encounter || typeof encounter !== 'object') {
    errors.push('encounter must be an object.');
  } else if (
    !isNonEmptyArray(encounter.champions) &&
    !isNonEmptyText(encounter.surge) &&
    !isNonEmptyArray(encounter.shields)
  ) {
    errors.push('encounter must declare at least one of champions, surge or shields.');
  }

  if (!catalogue || !Array.isArray(catalogue.components)) {
    errors.push('catalogue.components must be an array.');
  }

  if (!counterRules || !Array.isArray(counterRules.rules)) {
    errors.push('counterRules.rules must be an array.');
  }

  return errors;
}

// ---- per-threat evaluation ------------------------------------------------

function evaluateChampion(subject, rule, buildIds, componentsById) {
  // Anti-Champion 2.0 is weapon-frame based. The engine can only assert coverage
  // if a VERIFIED componentRef counter is actually present in the build. Today
  // that is intentionally never true (frame table absent), so champions resolve
  // as UNRESOLVED — the honest state.
  const hint = unverifiedCounters(rule)
    .map((counter) => counter.value)
    .filter(Boolean);

  for (const counter of verifiedCounters(rule)) {
    if (isNonEmptyText(counter.componentRef) && buildIds.has(counter.componentRef)) {
      return {
        state: 'covered',
        via: {
          method: counter.method,
          value: counter.value,
          componentRef: counter.componentRef,
          componentName: componentName(componentsById, counter.componentRef)
        },
        note: counter.note ?? null
      };
    }
  }

  return {
    state: 'unresolved',
    via: null,
    note:
      `${subject} is a weapon-frame counter (Anti-Champion 2.0); bring ${article(subject)} ${subject}-stunning Legendary frame or a confirmed anti-${subject} exotic. This engine cannot verify that from the build until the weapon-frame table exists.` +
      (hint.length ? ` Legacy (unverified) leads to re-check: ${hint.join(', ')}.` : '')
  };
}

function evaluateSurge(subject, element) {
  // A surge is a damage BONUS, not a gate — so it is an optimisation, never a gap.
  if (element === 'Prismatic') {
    return {
      state: 'partial',
      via: null,
      note: `Prismatic can access ${subject}, but whether this build benefits depends on its actual ${subject} weapons/abilities.`
    };
  }
  if (element === subject) {
    return {
      state: 'aligned',
      via: { method: 'element', value: subject, componentRef: null, componentName: null },
      note: `Subclass element matches the ${subject} surge; ${subject} abilities and matching weapons gain the bonus.`
    };
  }
  return {
    state: 'misaligned',
    via: null,
    note: `Build element is ${element || 'unknown'}; the ${subject} surge is a bonus, not a requirement. Slot a ${subject} weapon to benefit from it.`
  };
}

function evaluateShield(subject, element, matchGame) {
  // Elemental shields always take reduced non-matching damage; Match Game makes a
  // matching source mandatory across all combatants. Coverage is assessed from the
  // subclass element only (weapon elements not catalogued yet).
  const gate = matchGame ? 'required' : 'recommended';
  if (element === 'Prismatic') {
    return {
      state: 'partial',
      via: null,
      note: `Prismatic can access ${subject}, but a confirmed ${subject} damage source in this build is not established from the subclass alone.`,
      gate
    };
  }
  if (element === subject) {
    return {
      state: 'covered',
      via: { method: 'element', value: subject, componentRef: null, componentName: null },
      note: `Subclass element provides ${subject} ability damage to break the shield. Weapon-level ${subject} coverage is not separately verified yet.`,
      gate
    };
  }
  return {
    state: 'gap',
    via: null,
    note: `No confirmed ${subject} source from the subclass (build element is ${element || 'unknown'}). Under Match Game a ${subject} weapon or ability is needed to break the shield. Notable-weapon element data is not catalogued yet.`,
    gate
  };
}

// ---- main entry -----------------------------------------------------------

export function analyzeEncounterCoverage({ build, encounter, catalogue, counterRules }) {
  const inputErrors = validateInput({ build, encounter, catalogue, counterRules });

  if (inputErrors.length > 0) {
    return {
      counterEngineVersion: COUNTER_ENGINE_VERSION,
      status: 'missing encounter or build linkage',
      errors: inputErrors,
      encounter: encounter ?? null,
      build: null,
      coverage: [],
      gaps: [],
      limitations: [CHAMPION_FRAME_LIMITATION, WEAPON_ELEMENT_LIMITATION]
    };
  }

  const rulesByThreat = indexRulesByThreat(counterRules);
  const componentsById = new Map(catalogue.components.map((c) => [c.id, c]));
  const buildIds = collectBuildComponentIds(build);
  const element = buildElement(build);

  const champions = isNonEmptyArray(encounter.champions)
    ? [...new Set(encounter.champions.map(normalize).filter(Boolean))]
    : [];
  const surge = isNonEmptyText(encounter.surge) ? titleCaseElement(encounter.surge) : null;
  const shields = isNonEmptyArray(encounter.shields)
    ? [...new Set(encounter.shields.map(titleCaseElement).filter(Boolean))]
    : [];
  const matchGame = encounter.matchGame === true;

  const coverage = [];

  // Champions (required)
  for (const subject of champions) {
    const rule = rulesByThreat.get(`champion:${subject}`);
    if (!CHAMPION_SUBJECTS.has(subject) || !rule) {
      coverage.push({
        threat: 'champion',
        subject,
        requirement: 'required',
        state: 'unknown',
        via: null,
        reasoning: null,
        note: `No counter rule is catalogued for champion "${subject}".`,
        sources: []
      });
      continue;
    }
    const evalResult = evaluateChampion(subject, rule, buildIds, componentsById);
    coverage.push({
      threat: 'champion',
      subject,
      requirement: 'required',
      state: evalResult.state,
      via: evalResult.via,
      reasoning: rule.reasoning ?? null,
      note: evalResult.note,
      sources: isNonEmptyArray(rule.sources) ? rule.sources : []
    });
  }

  // Surge (optimisation)
  if (surge) {
    const rule = rulesByThreat.get(`surge:${surge}`);
    const evalResult = DAMAGE_ELEMENTS.has(surge) && rule
      ? evaluateSurge(surge, element)
      : { state: 'unknown', via: null, note: `No counter rule is catalogued for surge "${surge}".` };
    coverage.push({
      threat: 'surge',
      subject: surge,
      requirement: 'optimization',
      state: evalResult.state,
      via: evalResult.via,
      reasoning: rule?.reasoning ?? null,
      note: evalResult.note,
      sources: isNonEmptyArray(rule?.sources) ? rule.sources : []
    });
  }

  // Shields (required under Match Game, else recommended)
  for (const subject of shields) {
    const rule = rulesByThreat.get(`shield:${subject}`);
    if (!DAMAGE_ELEMENTS.has(subject) || !rule) {
      coverage.push({
        threat: 'shield',
        subject,
        requirement: matchGame ? 'required' : 'recommended',
        state: 'unknown',
        via: null,
        reasoning: null,
        note: `No counter rule is catalogued for shield "${subject}".`,
        sources: []
      });
      continue;
    }
    const evalResult = evaluateShield(subject, element, matchGame);
    coverage.push({
      threat: 'shield',
      subject,
      requirement: evalResult.gate,
      state: evalResult.state,
      via: evalResult.via,
      reasoning: rule.reasoning ?? null,
      note: evalResult.note,
      sources: isNonEmptyArray(rule.sources) ? rule.sources : []
    });
  }

  // A required threat is "settled" only if covered/aligned. gap/unresolved/unknown
  // on a required threat blocks a "ready" verdict.
  const settledStates = new Set(['covered', 'aligned']);
  const blockingThreats = coverage.filter(
    (entry) => entry.requirement === 'required' && !settledStates.has(entry.state)
  );

  const gaps = blockingThreats.map((entry) => {
    const label =
      entry.state === 'unresolved'
        ? 'unresolved'
        : entry.state === 'gap'
          ? 'not covered'
          : entry.state;
    return `${entry.threat} ${entry.subject}: ${label}.`;
  });

  const limitations = [];
  if (champions.length > 0) limitations.push(CHAMPION_FRAME_LIMITATION);
  if (surge || shields.length > 0) limitations.push(WEAPON_ELEMENT_LIMITATION);

  return {
    counterEngineVersion: COUNTER_ENGINE_VERSION,
    status: blockingThreats.length === 0 ? 'ready' : 'partial',
    encounter: { champions, surge, shields, matchGame },
    build: {
      id: build.id ?? build.buildId ?? null,
      class: build.class,
      element
    },
    coverage,
    gaps,
    limitations
  };
}

export {
  COUNTER_ENGINE_VERSION,
  CHAMPION_FRAME_LIMITATION,
  WEAPON_ELEMENT_LIMITATION
};
