export const BUILD_DATA_URL = './data/armor-3-builds.json';

const VALID_CLASSES = new Set(['Hunter', 'Titan', 'Warlock']);
const VALID_SUBCLASSES = new Set(['Arc', 'Solar', 'Void', 'Stasis', 'Strand', 'Prismatic']);

export function isRenderableBuild(build) {
  return Boolean(
    build &&
    typeof build.id === 'string' &&
    typeof build.name === 'string' &&
    VALID_CLASSES.has(build.class) &&
    VALID_SUBCLASSES.has(build.subclass) &&
    Array.isArray(build.activityTags) &&
    build.armor3?.statTargets
  );
}

export function selectBuilds(builds, filters = {}) {
  const subclass = filters.subclass || 'all';
  const activity = filters.activity || 'all';

  return builds
    .filter(isRenderableBuild)
    .filter((build) => subclass === 'all' || build.subclass.toLowerCase() === subclass.toLowerCase())
    .filter((build) => activity === 'all' || build.activityTags.includes(activity))
    .sort((a, b) => {
      if (a.verified !== b.verified) return Number(b.verified) - Number(a.verified);

      const aExact = activity !== 'all' && a.activityTags.includes(activity) ? 1 : 0;
      const bExact = activity !== 'all' && b.activityTags.includes(activity) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      return a.name.localeCompare(b.name);
    });
}

export function availableFilters(builds) {
  const subclasses = [...new Set(builds.filter(isRenderableBuild).map((build) => build.subclass))].sort();
  const activities = [...new Set(builds.filter(isRenderableBuild).flatMap((build) => build.activityTags))].sort();
  return { subclasses, activities };
}
