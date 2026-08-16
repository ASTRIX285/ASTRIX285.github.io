function normalizeAspectName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function matchesBuildContext(component, build) {
  const componentSubclass = String(component.subclass || component.element || '').trim().toLowerCase();
  const buildSubclass = String(build.subclass || '').trim().toLowerCase();

  return (
    component.type === 'aspect' &&
    component.verified === true &&
    component.class === build.class &&
    componentSubclass === buildSubclass
  );
}

export function resolveBuildAspectIds(build, components) {
  const eligible = components.filter((component) => matchesBuildContext(component, build));
  const eligibleById = new Map(eligible.map((component) => [component.id, component]));
  const stableIds = Array.isArray(build.subclassSetup?.aspectIds)
    ? [...new Set(build.subclassSetup.aspectIds)]
    : [];

  if (stableIds.length > 0) {
    const resolvedIds = [];
    const unresolved = [];

    for (const id of stableIds) {
      if (eligibleById.has(id)) {
        resolvedIds.push(id);
      } else {
        unresolved.push({
          id,
          name: null,
          matchCount: 0,
          resolution: 'stable-id',
          reason: 'Stable aspect id is missing, unverified, or does not match the build class and subclass.'
        });
      }
    }

    return { resolvedIds, unresolved, resolution: 'stable-id' };
  }

  const names = Array.isArray(build.subclassSetup?.aspects)
    ? build.subclassSetup.aspects
    : [];
  const resolvedIds = [];
  const unresolved = [];

  for (const name of names) {
    const normalizedName = normalizeAspectName(name);
    const matches = eligible.filter(
      (component) => normalizeAspectName(component.name) === normalizedName
    );

    if (matches.length === 1) {
      resolvedIds.push(matches[0].id);
    } else {
      unresolved.push({
        id: null,
        name,
        matchCount: matches.length,
        resolution: 'normalized-name',
        reason: matches.length === 0
          ? 'No verified aspect matched the normalized display name for this build context.'
          : 'More than one verified aspect matched the normalized display name; no guess was made.'
      });
    }
  }

  return { resolvedIds, unresolved, resolution: 'normalized-name' };
}

export { normalizeAspectName };
