/**
 * Guardian Build Forge Destiny Knowledge domain.
 *
 * Additive facade over the services that already exist. Existing files,
 * imports, workflows and data paths remain unchanged.
 */

export {
  WeaponService,
  WEAPON_SERVICE_VERSION,
  DEFAULT_WEAPON_CATALOGUE_URL
} from '../../services/weapon-service.mjs';

export {
  ArmorService,
  ARMOR_SERVICE_VERSION,
  DEFAULT_ARMOR_CATALOGUE_URL
} from '../../services/armor-service.mjs';

export {
  GameComponentService,
  DEFAULT_GAME_COMPONENTS_URL
} from '../../services/game-component-service.mjs';

export {
  CosmeticService,
  COSMETIC_SERVICE_VERSION,
  DEFAULT_COSMETIC_CATALOGUE_URL
} from '../../services/cosmetic-service.mjs';

export {
  KnowledgeGraphService
} from '../../services/knowledge-graph-service.mjs';
