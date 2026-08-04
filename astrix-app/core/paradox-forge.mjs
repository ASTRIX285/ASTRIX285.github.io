/**
 * Stable composition entry point for ASTRIX Paradox.
 *
 * Existing consumers can continue importing directly from /services.
 * New code can use the platform and game-module facades without forcing a
 * repository-wide migration.
 */
export * as Platform from '../platform/index.mjs';
export * as Destiny2 from '../games/destiny-2/index.mjs';

// Backward-compatible domain exports.
export * as DestinyKnowledge from '../domains/destiny-knowledge/index.mjs';
export * as PlayerIdentity from '../domains/player-identity/index.mjs';
