const CHAMPION_LABELS = [
  ['barrier', /\bBarrier Champions?\b/i],
  ['overload', /\bOverload Champions?\b/i],
  ['unstoppable', /\bUnstoppable Champions?\b/i]
];

const ELEMENTS = ['Kinetic', 'Arc', 'Solar', 'Void', 'Stasis', 'Strand'];

function text(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pluralPattern(value) {
  const type = text(value);
  if (!type) return null;
  return new RegExp(`\\b${escaped(type)}s?\\b`, 'i');
}

function championType(description) {
  for (const [type, pattern] of CHAMPION_LABELS) {
    if (pattern.test(description)) return type;
  }
  return null;
}

function mentionsWeaponType(description, weaponType) {
  const pattern = pluralPattern(weaponType);
  return Boolean(pattern && pattern.test(description));
}

function normalizedElement(value) {
  const found = ELEMENTS.find(element => lower(element) === lower(value));
  return found ?? null;
}

function explicitElementWeaponMatch(description, element) {
  if (!element) return false;
  const escapedElement = escaped(element);
  return new RegExp(`\\b${escapedElement}\\b.{0,24}\\bweapons?\\b|\\bweapons?\\b.{0,24}\\b${escapedElement}\\b`, 'i').test(description);
}

function superMatchingWeapon(description, weapon, subclass) {
  if (!/\bweapon matching your equipped Super\b/i.test(description)) return false;
  const weaponElement = normalizedElement(weapon?.element);
  const subclassElement = normalizedElement(subclass?.element ?? subclass?.superElement);
  return Boolean(weaponElement && subclassElement && weaponElement === subclassElement);
}

function normalizeWeapon(weapon) {
  return {
    hash: Number(weapon?.hash ?? weapon?.bungieHash),
    name: text(weapon?.name),
    weaponType: text(weapon?.weaponType ?? weapon?.itemTypeDisplayName),
    element: normalizedElement(weapon?.element)
  };
}

function artifactCitation(perk) {
  return {
    perkHash: Number(perk.perkHash),
    sandboxPerkHash: Number(perk.sandboxPerkHash),
    name: perk.name,
    description: perk.description,
    column: perk.column,
    order: perk.order
  };
}

function equippedCitation(weapons) {
  return weapons.map(weapon => ({
    hash: weapon.hash,
    name: weapon.name,
    weaponType: weapon.weaponType,
    element: weapon.element
  }));
}

function artifactState(artifactData, currentSeasonNumber) {
  if (!artifactData || !Array.isArray(artifactData.perks) || artifactData.perks.length === 0 || !Number.isInteger(artifactData.seasonNumber)) {
    return { status: 'missing-artifact', blocker: 'Current artifact data is missing or empty.' };
  }
  if (!Number.isInteger(currentSeasonNumber)) {
    return { status: 'current-season-unresolved', blocker: 'Current season number was not supplied; artifact freshness cannot be verified.' };
  }
  if (artifactData.seasonNumber !== currentSeasonNumber) {
    return { status: 'stale-artifact', blocker: `Cached artifact season ${artifactData.seasonNumber} does not match current season ${currentSeasonNumber}.` };
  }
  return { status: 'current', blocker: null };
}

export function resolveBuildWeapons(weaponHashes, manifestDefinitions, curatedTags = {}) {
  const getDefinition=typeof manifestDefinitions?.get==='function'
    ?hash=>manifestDefinitions.get('DestinyInventoryItemDefinition',hash)
    :hash=>manifestDefinitions?.[String(hash)]??null;
  const tags = curatedTags?.inventoryItems ?? {};
  const weapons = [];
  const unresolved = [];
  for (const rawHash of weaponHashes ?? []) {
    const hash = Number(rawHash);
    const definition=getDefinition(hash);
    const row = tags[String(hash)];
    if (!definition || definition.itemType !== 3 || !row?.weaponType || !row?.element) {
      unresolved.push(hash);
      continue;
    }
    weapons.push({
      hash,
      name: definition.displayProperties?.name ?? `Unnamed Destiny definition ${hash}`,
      weaponType: row.weaponType,
      element: row.element
    });
  }
  return { weapons, unresolved };
}

export function recommendArtifactPerks(build, artifactData, { currentSeasonNumber } = {}) {
  const state = artifactState(artifactData, currentSeasonNumber);
  if (state.status !== 'current') {
    return {
      status: state.status,
      seasonNumber: artifactData?.seasonNumber ?? null,
      currentSeasonNumber: Number.isInteger(currentSeasonNumber) ? currentSeasonNumber : null,
      artifactHash: artifactData?.artifactHash ?? null,
      recommendations: [],
      blockers: [state.blocker]
    };
  }

  const weapons = (build?.weapons ?? []).map(normalizeWeapon).filter(weapon => Number.isFinite(weapon.hash));
  const recommendations = [];

  for (const perk of artifactData.perks) {
    const description = text(perk.description);
    if (!description) continue;

    const champion = championType(description);
    if (champion) {
      const matched = weapons.filter(weapon => weapon.weaponType && mentionsWeaponType(description, weapon.weaponType));
      if (matched.length) {
        recommendations.push({
          category: 'champion',
          championType: champion,
          artifactPerk: artifactCitation(perk),
          triggeredBy: equippedCitation(matched),
          match: 'equipped-weapon-type'
        });
      }
    }

    const elementMatched = weapons.filter(weapon =>
      explicitElementWeaponMatch(description, weapon.element) || superMatchingWeapon(description, weapon, build?.subclass)
    );
    if (elementMatched.length) {
      recommendations.push({
        category: 'surge-element',
        artifactPerk: artifactCitation(perk),
        triggeredBy: equippedCitation(elementMatched),
        match: /\bweapon matching your equipped Super\b/i.test(description)
          ? 'weapon-element-matches-subclass-super-element'
          : 'explicit-weapon-element'
      });
    }
  }

  recommendations.sort((a, b) =>
    Number(a.artifactPerk.column) - Number(b.artifactPerk.column) ||
    Number(a.artifactPerk.order) - Number(b.artifactPerk.order) ||
    a.category.localeCompare(b.category)
  );

  return {
    status: 'current',
    seasonNumber: artifactData.seasonNumber,
    currentSeasonNumber,
    artifactHash: artifactData.artifactHash,
    recommendations,
    blockers: []
  };
}
