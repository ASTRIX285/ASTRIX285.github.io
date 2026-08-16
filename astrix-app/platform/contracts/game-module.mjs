/**
 * Generic contract implemented by every supported game.
 *
 * Platform code must depend on this contract, not on Destiny-specific names.
 */
export const GAME_MODULE_CONTRACT_VERSION = '1.0.0';

const REQUIRED_METHODS = [
  'getMetadata',
  'normalisePlayer',
  'normaliseCharacter',
  'normaliseEquipment',
  'normaliseAbilities',
  'normalisePassives',
  'normaliseEncounter',
  'explainRecommendation'
];

export function validateGameModule(module) {
  if (!module || typeof module !== 'object') {
    throw new TypeError('Game module must be an object.');
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof module[method] !== 'function') {
      throw new TypeError(`Game module is missing ${method}().`);
    }
  }

  const metadata = module.getMetadata();

  if (!metadata?.id || !metadata?.name || !metadata?.version) {
    throw new TypeError('Game module metadata requires id, name and version.');
  }

  return module;
}

export function createGameModuleRegistry() {
  const modules = new Map();

  return {
    register(module) {
      const valid = validateGameModule(module);
      const metadata = valid.getMetadata();
      modules.set(metadata.id, valid);
      return valid;
    },
    get(gameId) {
      return modules.get(gameId) ?? null;
    },
    has(gameId) {
      return modules.has(gameId);
    },
    list() {
      return [...modules.values()].map(module => module.getMetadata());
    }
  };
}
