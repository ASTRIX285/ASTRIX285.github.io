# ASTRIX Paradox multigame platform

## Locked direction

Destiny 2 is the first implementation and proving ground. The reusable product is the ASTRIX Paradox platform: a game-agnostic system that combines verified game knowledge, player state, encounter context and explainable recommendations.

## Boundary rule

Before adding a feature, decide whether it belongs to the platform or to a game module.

- Platform code uses generic concepts such as player, character, equipment, ability, passive modifier, encounter requirement, recommendation and evidence path.
- Game-module code translates game-specific concepts into those generic concepts.
- Presentation may use each game's native language and visual structure.

## Current structure

```text
astrix-app/
  platform/
    contracts/
      game-module.mjs
    index.mjs
  games/
    destiny-2/
      index.mjs
  core/
    paradox-forge.mjs
  domains/
    destiny-knowledge/
    player-identity/
```

## Non-breaking migration

No existing Destiny importer, catalogue, service, workflow, graph or UI is moved or renamed. Existing imports remain valid. New features may adopt the platform facade gradually.

## Destiny mapping

| Destiny concept | Platform concept |
| --- | --- |
| Weapon | Equipment |
| Armour | Equipment |
| Super, grenade, melee | Ability |
| Aspect | Passive modifier |
| Fragment | Passive modifier |
| Artifact perk | Passive modifier |
| Champion | Encounter requirement |
| Surge or activity modifier | Encounter requirement |
| Guardian | Character |
| Bungie profile | Player identity source |

## Rules

1. The platform must not contain Destiny hashes, Bungie endpoints or Destiny-specific terminology.
2. Destiny remains the source of truth for Destiny-specific behaviour.
3. Game modules translate, they do not replace verified source data.
4. Recommendations must expose an evidence path and trade-offs.
5. No game module may auto-invent effects, builds or relationships.
6. Existing production code is migrated only after tests prove parity.

## Next implementation steps

1. Validate the generic game-module contract against the current Destiny services.
2. Add a Destiny normalisation adapter for player, character, equipment, abilities, passives and encounters.
3. Add generic recommendation and evidence-path contracts.
4. Use the Guardian Workspace as the first presentation consuming both the platform and Destiny module.
5. Prove the model with Destiny before adding another game module.
