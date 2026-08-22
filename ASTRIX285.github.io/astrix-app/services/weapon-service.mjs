/**
 * Guardian Build Forge Weapon Service
 *
 * File:
 *   astrix-app/services/weapon-service.mjs
 *
 * Purpose:
 *   Read and index the generated weapon-information.json catalogue.
 *
 * Important:
 *   - This service is read-only.
 *   - It does not call the Bungie API directly.
 *   - GitHub Actions generates weapon-information.json from the Bungie manifest.
 *   - Existing build records continue using build.weapons.examples.
 */

export const WEAPON_SERVICE_VERSION = '2.0.0';

export const DEFAULT_WEAPON_CATALOGUE_URL =
  './data/weapon-information.catalogue.json';

const VALID_AMMO_TYPES = new Set([
  'Primary',
  'Special',
  'Power',
  'Unknown'
]);

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(/\s+/g, ' ');
}

function normalizeHash(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function uniqueWeapons(weapons) {
  const seen = new Set();
  const unique = [];

  for (const weapon of weapons) {
    const key = normalizeHash(weapon?.bungieHash) ?? weapon?.id;

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(weapon);
  }

  return unique;
}

function sortWeapons(weapons) {
  return [...weapons].sort((left, right) => {
    const nameOrder = String(left.name ?? '').localeCompare(
      String(right.name ?? ''),
      undefined,
      {
        sensitivity: 'base',
        numeric: true
      }
    );

    if (nameOrder !== 0) {
      return nameOrder;
    }

    return String(left.bungieHash ?? '').localeCompare(
      String(right.bungieHash ?? ''),
      undefined,
      {
        numeric: true
      }
    );
  });
}

function addToGroupedIndex(index, key, weapon) {
  const normalizedKey = normalizeText(key);

  if (!normalizedKey) {
    return;
  }

  if (!index.has(normalizedKey)) {
    index.set(normalizedKey, []);
  }

  index.get(normalizedKey).push(weapon);
}

function catalogueError(message, details = {}) {
  const error = new Error(message);
  error.name = 'WeaponCatalogueError';
  error.details = details;
  return error;
}

export class WeaponService {
  constructor(options = {}) {
    this.catalogueUrl =
      options.catalogueUrl ?? DEFAULT_WEAPON_CATALOGUE_URL;

    this.fetchImplementation =
      options.fetchImplementation ?? globalThis.fetch;

    this.loaded = false;
    this.loadingPromise = null;
    this.catalogue = null;

    this.byHash = new Map();
    this.byId = new Map();
    this.byName = new Map();
    this.byWeaponType = new Map();
    this.byElement = new Map();
    this.byAmmoType = new Map();
    this.byFrame = new Map();
    this.bySource = new Map();
    this.byLoopContribution = new Map();

    this.validationWarnings = [];
  }

  /**
   * Load and index the generated static weapon catalogue.
   *
   * Repeated calls reuse the same in-flight or completed request unless
   * forceReload is true.
   */
  async load(options = {}) {
    const {
      url = this.catalogueUrl,
      forceReload = false
    } = options;

    if (!forceReload && this.loaded && this.catalogue) {
      return this.catalogue;
    }

    if (!forceReload && this.loadingPromise) {
      return this.loadingPromise;
    }

    if (typeof this.fetchImplementation !== 'function') {
      throw catalogueError(
        'WeaponService requires a fetch implementation.'
      );
    }

    this.loadingPromise = this.#loadFromUrl(url);

    try {
      return await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  async #loadFromUrl(url) {
    const response = await this.fetchImplementation(url, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw catalogueError(
        `Unable to load weapon catalogue: ${response.status} ${response.statusText}`,
        {
          url,
          status: response.status
        }
      );
    }

    let catalogue;

    try {
      catalogue = await response.json();
    } catch (error) {
      throw catalogueError(
        'Weapon catalogue response was not valid JSON.',
        {
          url,
          cause: error
        }
      );
    }

    this.setCatalogue(catalogue);

    return this.catalogue;
  }

  /**
   * Supply an already-loaded catalogue.
   *
   * Useful for tests, server-side use, or callers that fetch several
   * catalogues together.
   */
  setCatalogue(catalogue) {
    this.validateCatalogue(catalogue);

    this.catalogue = catalogue;
    this.buildIndexes();
    this.loaded = true;

    return this.catalogue;
  }

  validateCatalogue(catalogue) {
    const errors = [];
    const warnings = [];

    if (!isObject(catalogue)) {
      throw catalogueError(
        'Weapon catalogue must be an object.'
      );
    }

    if (!isNonEmptyText(catalogue.schemaVersion)) {
      errors.push('schemaVersion must be a non-empty string.');
    }

    if (!isNonEmptyText(catalogue.generatedAt)) {
      errors.push('generatedAt must be a non-empty string.');
    }

    if (!isNonEmptyText(catalogue.manifestVersion)) {
      errors.push('manifestVersion must be a non-empty string.');
    }

    if (!Array.isArray(catalogue.weapons)) {
      errors.push('weapons must be an array.');
    }

    if (errors.length > 0) {
      throw catalogueError(
        'Weapon catalogue failed top-level validation.',
        {
          errors
        }
      );
    }

    const ids = new Set();
    const hashes = new Set();

    catalogue.weapons.forEach((weapon, index) => {
      const recordErrors = this.validateWeaponRecord(
        weapon,
        index
      );

      errors.push(...recordErrors.errors);
      warnings.push(...recordErrors.warnings);

      if (isNonEmptyText(weapon?.id)) {
        if (ids.has(weapon.id)) {
          errors.push(
            `weapons[${index}].id duplicates ${weapon.id}.`
          );
        }

        ids.add(weapon.id);
      }

      const hash = normalizeHash(weapon?.bungieHash);

      if (hash) {
        if (hashes.has(hash)) {
          errors.push(
            `weapons[${index}].bungieHash duplicates ${hash}.`
          );
        }

        hashes.add(hash);
      }
    });

    if (errors.length > 0) {
      throw catalogueError(
        'Weapon catalogue contains invalid records.',
        {
          errors,
          warnings
        }
      );
    }

    this.validationWarnings = warnings;

    return {
      valid: true,
      errors: [],
      warnings
    };
  }

  validateWeaponRecord(weapon, index = 0) {
    const errors = [];
    const warnings = [];
    const prefix = `weapons[${index}]`;

    if (!isObject(weapon)) {
      return {
        errors: [`${prefix} must be an object.`],
        warnings
      };
    }

    if (!isNonEmptyText(weapon.id)) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    }

    if (
      weapon.bungieHash === null ||
      weapon.bungieHash === undefined ||
      weapon.bungieHash === ''
    ) {
      errors.push(`${prefix}.bungieHash is required.`);
    }

    if (!isNonEmptyText(weapon.name)) {
      errors.push(`${prefix}.name must be a non-empty string.`);
    }

    if (!isNonEmptyText(weapon.weaponType)) {
      warnings.push(
        `${prefix}.weaponType is empty.`
      );
    }

    if (
      !VALID_AMMO_TYPES.has(
        weapon.ammoType ?? 'Unknown'
      )
    ) {
      errors.push(
        `${prefix}.ammoType must be Primary, Special, Power or Unknown.`
      );
    }

    if (!isObject(weapon.official)) {
      errors.push(`${prefix}.official must be an object.`);
    }

    if (!isObject(weapon.curated)) {
      errors.push(`${prefix}.curated must be an object.`);
    }

    const forbiddenRankingFields = [
      'rank',
      'ranking',
      'tier',
      'score',
      'position'
    ];

    for (const field of forbiddenRankingFields) {
      if (Object.hasOwn(weapon, field)) {
        errors.push(
          `${prefix}.${field} is forbidden in the information catalogue.`
        );
      }

      if (
        isObject(weapon.curated) &&
        Object.hasOwn(weapon.curated, field)
      ) {
        errors.push(
          `${prefix}.curated.${field} is forbidden in the information catalogue.`
        );
      }
    }

    return {
      errors,
      warnings
    };
  }

  buildIndexes() {
    this.clearIndexes();

    for (const weapon of this.catalogue.weapons) {
      this.indexWeapon(weapon);
    }

    for (const index of [
      this.byName,
      this.byWeaponType,
      this.byElement,
      this.byAmmoType,
      this.byFrame,
      this.bySource,
      this.byLoopContribution
    ]) {
      for (const [key, weapons] of index.entries()) {
        index.set(key, sortWeapons(uniqueWeapons(weapons)));
      }
    }
  }

  clearIndexes() {
    this.byHash.clear();
    this.byId.clear();
    this.byName.clear();
    this.byWeaponType.clear();
    this.byElement.clear();
    this.byAmmoType.clear();
    this.byFrame.clear();
    this.bySource.clear();
    this.byLoopContribution.clear();
  }

  indexWeapon(weapon) {
    const hash = normalizeHash(weapon.bungieHash);

    if (hash) {
      this.byHash.set(hash, weapon);
    }

    if (isNonEmptyText(weapon.id)) {
      this.byId.set(weapon.id, weapon);
    }

    addToGroupedIndex(
      this.byName,
      weapon.name,
      weapon
    );

    addToGroupedIndex(
      this.byWeaponType,
      weapon.weaponType,
      weapon
    );

    addToGroupedIndex(
      this.byElement,
      weapon.element ?? 'Unknown',
      weapon
    );

    addToGroupedIndex(
      this.byAmmoType,
      weapon.ammoType ?? 'Unknown',
      weapon
    );

    addToGroupedIndex(
      this.byFrame,
      weapon.frame ?? 'Unknown',
      weapon
    );

    addToGroupedIndex(
      this.bySource,
      weapon.source ?? 'Unknown',
      weapon
    );

    const loopContributions = Array.isArray(
      weapon.curated?.loopContribution
    )
      ? weapon.curated.loopContribution
      : [];

    for (const contribution of loopContributions) {
      addToGroupedIndex(
        this.byLoopContribution,
        contribution,
        weapon
      );
    }
  }

  ensureLoaded() {
    if (!this.loaded || !this.catalogue) {
      throw catalogueError(
        'Weapon catalogue has not been loaded.'
      );
    }
  }

  getMetadata() {
    this.ensureLoaded();

    return {
      serviceVersion: WEAPON_SERVICE_VERSION,
      schemaVersion: this.catalogue.schemaVersion,
      generatedAt: this.catalogue.generatedAt,
      manifestVersion: this.catalogue.manifestVersion,
      weaponCount: this.catalogue.weapons.length,
      warnings: [...this.validationWarnings]
    };
  }

  getAllWeapons() {
    this.ensureLoaded();

    return sortWeapons(this.catalogue.weapons);
  }

  getByHash(hash) {
    this.ensureLoaded();

    const normalizedHash = normalizeHash(hash);

    return normalizedHash
      ? this.byHash.get(normalizedHash) ?? null
      : null;
  }

  getById(id) {
    this.ensureLoaded();

    return this.byId.get(String(id ?? '')) ?? null;
  }

  getByName(name) {
    this.ensureLoaded();

    return [
      ...(this.byName.get(normalizeText(name)) ?? [])
    ];
  }

  getUniqueByName(name) {
    const matches = this.getByName(name);

    if (matches.length === 1) {
      return {
        status: 'resolved',
        weapon: matches[0],
        candidates: matches
      };
    }

    if (matches.length > 1) {
      return {
        status: 'ambiguous',
        weapon: null,
        candidates: matches
      };
    }

    return {
      status: 'unresolved',
      weapon: null,
      candidates: []
    };
  }

  getByWeaponType(type) {
    this.ensureLoaded();

    return [
      ...(this.byWeaponType.get(normalizeText(type)) ?? [])
    ];
  }

  getByElement(element) {
    this.ensureLoaded();

    return [
      ...(this.byElement.get(normalizeText(element)) ?? [])
    ];
  }

  getByAmmoType(ammoType) {
    this.ensureLoaded();

    return [
      ...(this.byAmmoType.get(normalizeText(ammoType)) ?? [])
    ];
  }

  getByFrame(frame) {
    this.ensureLoaded();

    return [
      ...(this.byFrame.get(normalizeText(frame)) ?? [])
    ];
  }

  getBySource(source) {
    this.ensureLoaded();

    return [
      ...(this.bySource.get(normalizeText(source)) ?? [])
    ];
  }

  getByLoopContribution(contribution) {
    this.ensureLoaded();

    return [
      ...(
        this.byLoopContribution.get(
          normalizeText(contribution)
        ) ?? []
      )
    ];
  }

  /**
   * Resolve existing build.weapons.examples entries.
   *
   * This keeps the current build schema untouched.
   */
  resolveBuildWeaponExamples(build) {
    this.ensureLoaded();

    const examples = Array.isArray(build?.weapons?.examples)
      ? build.weapons.examples
      : [];

    const resolved = [];
    const unresolved = [];
    const ambiguous = [];

    for (const sourceName of examples) {
      const resolution = this.getUniqueByName(sourceName);

      if (resolution.status === 'resolved') {
        const weapon = resolution.weapon;

        resolved.push({
          sourceName,
          weaponId: weapon.id,
          bungieHash: weapon.bungieHash,
          weapon
        });

        continue;
      }

      if (resolution.status === 'ambiguous') {
        ambiguous.push({
          sourceName,
          candidates: resolution.candidates.map(
            (weapon) => ({
              weaponId: weapon.id,
              bungieHash: weapon.bungieHash,
              name: weapon.name,
              weaponType: weapon.weaponType,
              element: weapon.element,
              frame: weapon.frame
            })
          )
        });

        continue;
      }

      unresolved.push(sourceName);
    }

    return {
      resolved,
      unresolved,
      ambiguous
    };
  }

  /**
   * Search official and curated text.
   */
  search(query, filters = {}) {
    this.ensureLoaded();

    const normalizedQuery = normalizeText(query);

    const {
      weaponType = null,
      element = null,
      ammoType = null,
      frame = null,
      source = null,
      loopContribution = null,
      verified = null
    } = filters;

    const matches = this.catalogue.weapons.filter(
      (weapon) => {
        if (
          weaponType &&
          normalizeText(weapon.weaponType) !==
            normalizeText(weaponType)
        ) {
          return false;
        }

        if (
          element &&
          normalizeText(weapon.element) !==
            normalizeText(element)
        ) {
          return false;
        }

        if (
          ammoType &&
          normalizeText(weapon.ammoType) !==
            normalizeText(ammoType)
        ) {
          return false;
        }

        if (
          frame &&
          normalizeText(weapon.frame) !==
            normalizeText(frame)
        ) {
          return false;
        }

        if (
          source &&
          normalizeText(weapon.source) !==
            normalizeText(source)
        ) {
          return false;
        }

        if (
          typeof verified === 'boolean' &&
          weapon.verified !== verified
        ) {
          return false;
        }

        if (loopContribution) {
          const contributions = Array.isArray(
            weapon.curated?.loopContribution
          )
            ? weapon.curated.loopContribution
            : [];

          if (
            !contributions.some(
              (value) =>
                normalizeText(value) ===
                normalizeText(loopContribution)
            )
          ) {
            return false;
          }
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchableText = [
          weapon.name,
          weapon.weaponType,
          weapon.frame,
          weapon.element,
          weapon.ammoType,
          weapon.source,
          weapon.officialDescription,
          weapon.curated?.usageNotes,
          ...(
            weapon.curated?.loopContribution ?? []
          ),
          ...Object.values(
            weapon.curated?.recommendedConfiguration ?? {}
          ).flatMap((value) =>
            Array.isArray(value) ? value : [value]
          )
        ]
          .map(normalizeText)
          .join(' ');

        return searchableText.includes(normalizedQuery);
      }
    );

    return sortWeapons(matches);
  }

  unload() {
    this.loaded = false;
    this.loadingPromise = null;
    this.catalogue = null;
    this.validationWarnings = [];
    this.clearIndexes();
  }
}

export function createWeaponService(options = {}) {
  return new WeaponService(options);
}

export const weaponService = new WeaponService();
