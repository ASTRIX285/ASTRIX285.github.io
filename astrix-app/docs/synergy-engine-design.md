# ASTRIX PARADOX Synergy Engine Design

## Status

Architecture only.

No synergy logic is implemented.
No recommendations are generated.
No effects are inferred.
No synergies are invented.

The engine cannot reason over a component until that component has a recorded, verified effect.

## Scope

This design covers the static Armor 3.0 foundation only.

It does not add a backend, API, database service, live Bungie connection, frontend feature or new build record.

## Inputs

The future engine will accept a build context containing:

- build id
- class
- subclass
- element
- aspect component ids
- optional activity and difficulty context

The existing build records remain unchanged in this stage.

## Component linkage

A future build-schema revision should reference library records by id rather than copying component text into each build.

Proposed future linkage fields:

```json
{
  "componentRefs": {
    "aspects": ["aspect-example-id"],
    "fragments": ["fragment-example-id"],
    "artifactPerks": ["artifact-perk-example-id"],
    "setBonuses": ["set-bonus-example-id"]
  }
}
```

These identifiers are structural examples only. They are not real component records and must not be added to production data.

## Verified component inputs

The future engine may read only component records that satisfy all applicable verification gates.

For fragments, aspects and artifact perks:

- component verified is true
- effect is populated
- sources are populated

For set bonuses:

- component verified is true
- 2-piece name is populated
- 2-piece effect is populated
- 2-piece verified is true
- 4-piece name is populated
- 4-piece effect is populated
- 4-piece verified is true
- sources are populated

Unverified or incomplete records must be excluded from deterministic reasoning.

## Deterministic processing design

A future implementation would:

1. Load the build context.
2. Resolve referenced aspects by component id.
3. Filter the component library to verified records only.
4. Filter components by applicable subclass or element where those fields are present.
5. Read the recorded effect text from eligible components.
6. Apply an explicit, versioned rule set to compare recorded effects with the build context.
7. Produce recommendations with traceable component ids and source references.
8. Reject or mark unavailable any recommendation that depends on missing or unverified effects.

No natural-language guesswork should substitute for missing component data.

## Outputs

The future engine may produce:

- recommended fragment component ids
- recommended artifact-perk component ids
- recommended Armor 3.0 set-bonus component ids to farm
- deterministic reason codes
- supporting verified component ids
- supporting source references
- unavailable reasons when verified data is insufficient

## Readiness behaviour

When the library lacks verified effects, the engine should return an explicit unavailable result rather than a speculative recommendation.

Example status categories:

- ready
- insufficient verified component data
- missing build linkage
- no applicable verified component

These are design categories only. No runtime logic exists in this stage.

## Non-goals

This stage does not:

- implement synergy scoring
- rank fragments, aspects, perks or sets
- infer relationships from names
- scrape external data
- modify builds
- create new builds
- change the frontend
- add a backend
- alter the live root site
