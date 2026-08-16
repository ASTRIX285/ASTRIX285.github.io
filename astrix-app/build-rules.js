export const BUILD_DATA_URL = './data/armor-3-builds.json';
export const CANONICAL_SUBCLASSES = ['Arc', 'Solar', 'Void', 'Stasis', 'Strand', 'Prismatic'];

const VALID_CLASSES = new Set(['Hunter', 'Titan', 'Warlock']);
const VALID_SUBCLASSES = new Set(CANONICAL_SUBCLASSES);
const ALL_FILTER = 'all';

function normalise(value) {
  return String(value ?? '').trim().toLowerCase();
}

function matchesScalar(actual, selected) {
  return normalise(selected) === ALL_FILTER || normalise(actual) === normalise(selected);
}

function matchesList(values, selected) {
  return normalise(selected) === ALL_FILTER || (
    Array.isArray(values) && values.some((value) => normalise(value) === normalise(selected))
  );
}

export function isRenderableBuild(build) {
  return Boolean(
    build &&
    typeof build.id === 'string' &&
    typeof build.name === 'string' &&
    VALID_CLASSES.has(build.class) &&
    VALID_SUBCLASSES.has(build.subclass) &&
    Array.isArray(build.role) &&
    Array.isArray(build.activityTags) &&
    Array.isArray(build.difficultyTags) &&
    build.armor3?.statTargets
  );
}

export function selectBuilds(builds, filters = {}) {
  const selected = {
    className: filters.className || ALL_FILTER,
    subclass: filters.subclass || ALL_FILTER,
    activity: filters.activity || ALL_FILTER,
    role: filters.role || ALL_FILTER,
    difficulty: filters.difficulty || ALL_FILTER
  };

  return builds
    .filter(isRenderableBuild)
    .filter((build) => matchesScalar(build.class, selected.className))
    .filter((build) => matchesScalar(build.subclass, selected.subclass))
    .filter((build) => matchesList(build.activityTags, selected.activity))
    .filter((build) => matchesList(build.role, selected.role))
    .filter((build) => matchesList(build.difficultyTags, selected.difficulty))
    .sort((a, b) => {
      if (a.verified !== b.verified) return Number(b.verified) - Number(a.verified);
      return a.name.localeCompare(b.name);
    });
}

export function findBuildById(builds, buildId) {
  return builds.find((build) => isRenderableBuild(build) && build.id === buildId) || null;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function availableFilters(builds) {
  const renderable = builds.filter(isRenderableBuild);
  const subclassCounts = Object.fromEntries(
    CANONICAL_SUBCLASSES.map((subclass) => [
      subclass,
      renderable.filter((build) => build.subclass === subclass).length
    ])
  );

  return {
    classes: uniqueSorted(renderable.map((build) => build.class)),
    subclasses: [...CANONICAL_SUBCLASSES],
    subclassCounts,
    activities: uniqueSorted(renderable.flatMap((build) => build.activityTags)),
    roles: uniqueSorted(renderable.flatMap((build) => build.role)),
    difficulties: uniqueSorted(renderable.flatMap((build) => build.difficultyTags))
  };
}
