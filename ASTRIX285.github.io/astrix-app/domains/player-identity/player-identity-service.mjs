/**
 * Guardian Build Forge Player Identity Service
 *
 * Normalises authenticated Bungie profile data into one read-only snapshot.
 * This module does not perform OAuth, store tokens or call Bungie directly.
 * A caller supplies already-authorised profile component payloads.
 */

export const PLAYER_IDENTITY_SERVICE_VERSION = '1.0.0';

const isObject = (value) => Boolean(
  value && typeof value === 'object' && !Array.isArray(value)
);

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const values = (value) => isObject(value)
  ? Object.values(value)
  : [];

const hashKey = (value) => (
  value === null || value === undefined || value === ''
    ? null
    : String(value)
);

export function createEmptyPlayerIdentity() {
  return {
    schemaVersion: '1.0.0',
    generatedAt: null,
    account: null,
    profile: null,
    characters: [],
    characterEquipment: {},
    characterInventories: {},
    profileInventory: [],
    profileCurrencies: [],
    collections: {
      collectibles: {},
      records: {}
    },
    progression: {
      profile: {},
      characters: {}
    },
    presentation: {
      emblemHashByCharacter: {},
      equippedCosmeticHashes: []
    },
    source: {
      membershipType: null,
      destinyMembershipId: null,
      requestedComponents: []
    }
  };
}

function normaliseItems(component) {
  if (!isObject(component) || !Array.isArray(component.data?.items)) {
    return [];
  }

  return component.data.items.map((item) => clone(item));
}

function normaliseCharacterItems(component) {
  if (!isObject(component) || !isObject(component.data)) {
    return {};
  }

  const result = {};

  for (const [characterId, payload] of Object.entries(component.data)) {
    result[characterId] = Array.isArray(payload?.items)
      ? payload.items.map((item) => clone(item))
      : [];
  }

  return result;
}

export class PlayerIdentityService {
  constructor() {
    this.identity = createEmptyPlayerIdentity();
    this.byCharacterId = new Map();
    this.ownedItemHashes = new Set();
    this.unlockedCollectibleHashes = new Set();
  }

  setProfileResponse(response, context = {}) {
    if (!isObject(response)) {
      throw new TypeError('Player profile response must be an object.');
    }

    const source = response.Response ?? response;

    if (!isObject(source)) {
      throw new TypeError('Player profile response is missing Response data.');
    }

    const identity = createEmptyPlayerIdentity();
    const characters = values(source.characters?.data)
      .map((character) => clone(character));

    identity.generatedAt = new Date().toISOString();
    identity.account = context.account ? clone(context.account) : null;
    identity.profile = source.profile?.data
      ? clone(source.profile.data)
      : null;
    identity.characters = characters;
    identity.characterEquipment = normaliseCharacterItems(
      source.characterEquipment
    );
    identity.characterInventories = normaliseCharacterItems(
      source.characterInventories
    );
    identity.profileInventory = normaliseItems(source.profileInventory);
    identity.profileCurrencies = normaliseItems(source.profileCurrencies);
    identity.collections.collectibles = clone(
      source.profileCollectibles?.data?.collectibles ?? {}
    );
    identity.collections.records = clone(
      source.profileRecords?.data?.records ?? {}
    );
    identity.progression.profile = clone(
      source.profileProgression?.data ?? {}
    );
    identity.progression.characters = clone(
      source.characterProgressions?.data ?? {}
    );
    identity.source.membershipType = context.membershipType ?? null;
    identity.source.destinyMembershipId =
      context.destinyMembershipId ?? null;
    identity.source.requestedComponents = Array.isArray(context.components)
      ? [...context.components]
      : [];

    for (const character of characters) {
      const characterId = String(character.characterId ?? '');
      const emblemHash = hashKey(character.emblemHash);

      if (characterId && emblemHash) {
        identity.presentation.emblemHashByCharacter[characterId] = emblemHash;
      }
    }

    this.identity = identity;
    this.#buildIndexes();

    return this.getSnapshot();
  }

  #buildIndexes() {
    this.byCharacterId.clear();
    this.ownedItemHashes.clear();
    this.unlockedCollectibleHashes.clear();

    for (const character of this.identity.characters) {
      const id = String(character.characterId ?? '');
      if (id) this.byCharacterId.set(id, character);
    }

    const itemGroups = [
      this.identity.profileInventory,
      ...Object.values(this.identity.characterEquipment),
      ...Object.values(this.identity.characterInventories)
    ];

    for (const items of itemGroups) {
      for (const item of items) {
        const hash = hashKey(item.itemHash);
        if (hash) this.ownedItemHashes.add(hash);
      }
    }

    for (const [hash, state] of Object.entries(
      this.identity.collections.collectibles
    )) {
      const collectionState = Number(state?.state ?? 0);
      const isNotAcquired = (collectionState & 1) === 1;

      if (!isNotAcquired) {
        this.unlockedCollectibleHashes.add(String(hash));
      }
    }
  }

  getSnapshot() {
    return clone(this.identity);
  }

  getCharacter(characterId) {
    const character = this.byCharacterId.get(String(characterId));
    return character ? clone(character) : null;
  }

  ownsItemHash(itemHash) {
    return this.ownedItemHashes.has(String(itemHash));
  }

  hasUnlockedCollectible(collectibleHash) {
    return this.unlockedCollectibleHashes.has(String(collectibleHash));
  }

  createCosmeticOwnershipOverlay(cosmeticCatalogue) {
    const cosmetics = Array.isArray(cosmeticCatalogue?.cosmetics)
      ? cosmeticCatalogue.cosmetics
      : [];

    const overlay = {};

    for (const cosmetic of cosmetics) {
      const itemHash = hashKey(cosmetic.bungieHash);
      const collectibleHash = hashKey(cosmetic.collectibleHash);
      const ownedByItem = itemHash
        ? this.ownedItemHashes.has(itemHash)
        : false;
      const unlockedByCollection = collectibleHash
        ? this.unlockedCollectibleHashes.has(collectibleHash)
        : false;

      overlay[cosmetic.id] = {
        bungieHash: cosmetic.bungieHash ?? null,
        collectibleHash: cosmetic.collectibleHash ?? null,
        owned: ownedByItem || unlockedByCollection,
        unlocked: unlockedByCollection,
        evidence: {
          inventoryItem: ownedByItem,
          collection: unlockedByCollection
        }
      };
    }

    return overlay;
  }
}
