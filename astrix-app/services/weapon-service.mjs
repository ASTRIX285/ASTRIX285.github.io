/**
 * ============================================================================
 * Paradox Forge Weapon Service
 * File: astrix-app/services/weapon-service.mjs
 * Version: 2.0.0
 *
 * Purpose
 * -------
 * Central weapon lookup service for Paradox Forge.
 *
 * This service NEVER modifies weapon data.
 * It only indexes, validates and resolves it.
 *
 * Official Bungie data remains separate from curated ASTRIX data.
 *
 * ============================================================================
 */

const DEFAULT_PATH = "./data/weapon-information.json";

export class WeaponService {

    constructor() {

        this.loaded = false;

        this.catalogue = null;

        this.byHash = new Map();

        this.byId = new Map();

        this.byName = new Map();

        this.byWeaponType = new Map();

        this.byElement = new Map();

    }

    async load(path = DEFAULT_PATH) {

        if (this.loaded)
            return this.catalogue;

        const response = await fetch(path);

        if (!response.ok)
            throw new Error(
                `Unable to load weapon catalogue (${response.status})`
            );

        const catalogue = await response.json();

        this.validateCatalogue(catalogue);

        this.catalogue = catalogue;

        this.buildIndexes();

        this.loaded = true;

        return catalogue;

    }

    validateCatalogue(catalogue) {

        if (!catalogue)
            throw new Error("Weapon catalogue missing");

        if (!Array.isArray(catalogue.weapons))
            throw new Error(
                "Weapon catalogue contains no weapons array."
            );

    }

    buildIndexes() {

        this.byHash.clear();
        this.byId.clear();
        this.byName.clear();
        this.byWeaponType.clear();
        this.byElement.clear();

        for (const weapon of this.catalogue.weapons) {

            this.indexWeapon(weapon);

        }

    }

    indexWeapon(weapon) {

        if (!weapon)
            return;

        this.byHash.set(
            String(weapon.bungieHash),
            weapon
        );

        this.byId.set(
            weapon.id,
            weapon
        );

        const normalizedName =
            weapon.name
                .trim()
                .toLowerCase();

        if (!this.byName.has(normalizedName))
            this.byName.set(normalizedName, []);

        this.byName
            .get(normalizedName)
            .push(weapon);

        const type =
            weapon.weaponType ?? "Unknown";

        if (!this.byWeaponType.has(type))
            this.byWeaponType.set(type, []);

        this.byWeaponType
            .get(type)
            .push(weapon);

        const element =
            weapon.element ?? "Unknown";

        if (!this.byElement.has(element))
            this.byElement.set(element, []);

        this.byElement
            .get(element)
            .push(weapon);

    }

    getAllWeapons() {

        return this.catalogue.weapons;

    }

    getByHash(hash) {

        return this.byHash.get(String(hash));

    }

    getById(id) {

        return this.byId.get(id);

    }

    getByName(name) {

        if (!name)
            return [];

        return this.byName.get(
            name.trim().toLowerCase()
        ) ?? [];

    }

    getByWeaponType(type) {

        return this.byWeaponType.get(type) ?? [];

    }

    getByElement(element) {

        return this.byElement.get(element) ?? [];

    }

}
