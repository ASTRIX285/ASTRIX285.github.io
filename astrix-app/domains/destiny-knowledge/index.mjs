/**
 * Paradox Forge Destiny Knowledge domain.
 *
 * This file is an additive facade over the services that already exist.
 * Nothing is moved or renamed, so all current imports keep working.
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
  GAME_COMPONENT_SERVICE_VERSION,
  DEFAULT_GAME_COMPONENT_CATALOGUE_URL
} from '../../services/game-component-service.mjs';

export {
  CosmeticService,
  COSMETIC_SERVICE_VERSION,
  DEFAULT_COSMETIC_CATALOGUE_URL
} from '../../services/cosmetic-service.mjs';

export {
  KnowledgeGraphService,
  KNOWLEDGE_GRAPH_SERVICE_VERSION,
  DEFAULT_KNOWLEDGE_RELATIONSHIPS_URL
} from '../../services/knowledge-graph-service.mjs';
