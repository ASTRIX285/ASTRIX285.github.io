/**
 * Additive weapon linkage for existing build records.
 *
 * Existing builds keep their current:
 *   build.weapons.examples: string[]
 *
 * This module resolves those names against weapon-information.json without
 * changing the build schema or build data.
 */

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(/\s+/g, ' ');
}

export function createWeaponIndex(weaponCatalogue) {
  const weapons = Array.isArray(weaponCatalogue?.weapons)
    ? weaponCatalogue.weapons
    : [];

  const byId = new Map();
  const byHash = new Map();
  const byName = new Map();

  for (const weapon of weapons) {
    byId.set(weapon.id, weapon);
    byHash.set(String(weapon.bungieHash), weapon);

    const key = normalizeName(weapon.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(weapon);
  }

  return { byId, byHash, byName };
}

export function resolveBuildWeaponExamples(build, weaponCatalogue) {
  const index = createWeaponIndex(weaponCatalogue);
  const names = Array.isArray(build?.weapons?.examples)
    ? build.weapons.examples
    : [];

  const resolved = [];
  const unresolved = [];
  const ambiguous = [];

  for (const name of names) {
    const matches = index.byName.get(normalizeName(name)) ?? [];

    if (matches.length === 1) {
      resolved.push({
        sourceName: name,
        weaponId: matches[0].id,
        bungieHash: matches[0].bungieHash,
        weapon: matches[0]
      });
    } else if (matches.length > 1) {
      ambiguous.push({
        sourceName: name,
        candidateIds: matches.map((weapon) => weapon.id)
      });
    } else {
      unresolved.push(name);
    }
  }

  return { resolved, unresolved, ambiguous };
}
