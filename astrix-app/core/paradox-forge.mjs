/**
 * Stable composition entry point for new Paradox Forge features.
 *
 * Existing consumers can continue importing directly from /services.
 * New code may use this file without forcing a repository-wide migration.
 */

export * as DestinyKnowledge from '../domains/destiny-knowledge/index.mjs';
export * as PlayerIdentity from '../domains/player-identity/index.mjs';
