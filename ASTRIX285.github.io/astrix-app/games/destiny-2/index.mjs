/** Destiny 2 game module facade. Existing services remain unchanged. */
export * as DestinyKnowledge from '../../domains/destiny-knowledge/index.mjs';
export * as PlayerIdentity from '../../domains/player-identity/index.mjs';

export const DESTINY_GAME_MODULE = Object.freeze({
  id: 'destiny-2',
  name: 'Destiny 2',
  productName: 'Paradox Forge',
  version: '1.0.0',
  concepts: Object.freeze({
    weapon: 'equipment',
    armour: 'equipment',
    ability: 'ability',
    aspect: 'passive-modifier',
    fragment: 'passive-modifier',
    artifactPerk: 'passive-modifier',
    champion: 'encounter-requirement',
    activityModifier: 'encounter-requirement'
  })
});
