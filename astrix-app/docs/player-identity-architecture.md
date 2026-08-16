# Paradox Forge domain architecture

## Goal

Separate game knowledge, player identity, reasoning and presentation without moving or renaming the production files already in use.

## Non-breaking rule

This restructure is additive.

- Existing `/astrix-app/services/*` imports remain valid.
- Existing `/astrix-app/data/*` files remain in place.
- Existing importers and GitHub Actions remain unchanged.
- Existing `astrix*` internal naming remains unchanged.
- No generated or curated data is duplicated into a second source of truth.

## Domains

```text
astrix-app/
├── core/
│   └── paradox-forge.mjs
├── domains/
│   ├── destiny-knowledge/
│   │   └── index.mjs
│   └── player-identity/
│       ├── index.mjs
│       └── player-identity-service.mjs
├── services/          existing implementation services
├── data/              existing generated and curated catalogues
├── tools/             existing manifest importers and validators
└── presentation/      future Guardian, Forge and Encounter adapters
```

## Destiny Knowledge

The Destiny Knowledge facade exposes the existing read-only services for:

- weapons
- armour
- game components
- cosmetics
- directed knowledge relationships

It does not copy their data or replace their services.

## Player Identity

Player Identity owns player-specific facts only:

- Bungie membership context
- characters
- equipped items
- character inventories
- profile inventory and currencies
- collectibles and records
- progression
- presentation state such as equipped emblems

The initial service accepts an already-authorised Bungie profile response. It deliberately does not perform OAuth and does not store credentials or tokens.

## Ownership overlay

Static catalogues answer: `What exists?`

Player Identity answers: `What does this player own or have unlocked?`

The cosmetic ownership overlay joins these domains using Bungie item hashes and collectible hashes. Ownership is not written back into the static cosmetic catalogue.

## Reasoning boundary

Player Identity does not create builds or synergy claims. The recommendation and counter engines may query both domains later:

```text
Destiny Knowledge ─┐
                   ├── Recommendation and counter reasoning
Player Identity ───┘
```

Directed cause-and-effect relationships remain in the existing knowledge graph. Cosmetic and account facts do not enter that graph unless a future relationship has a verified gameplay mechanism.

## Migration strategy

1. Keep all existing imports working.
2. Use `core/paradox-forge.mjs` only for new features initially.
3. Add OAuth as an external adapter that supplies authorised responses to Player Identity.
4. Connect the Guardian screen through a presentation adapter.
5. Migrate older consumers gradually only when tests confirm equivalent behaviour.
6. Do not delete the old service entry points.
