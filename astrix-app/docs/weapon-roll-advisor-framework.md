# Paradox Forge contextual weapon-roll framework

## Purpose

Paradox Forge evaluates the perk choices that are actually available on a player's weapon instance and recommends the combination that best supports the current Guardian build. It does not use a universal community "god roll" as the answer.

## Data separation

1. Bungie-derived runtime facts
   - weapon item hash and instance id
   - currently selected perk plug hashes
   - selectable perk options by socket/column
   - intrinsic trait, origin trait, mod and enhancement state when available

2. Curated Paradox intelligence
   - verified perk effects only
   - emitted state tokens
   - consumed state tokens / trigger conditions
   - build roles, strengths and limitations
   - evidence references

The Bungie manifest refresh may update factual definitions, but it must never overwrite `weapon-perk-intelligence.json`.

## Reasoning contract

A synergy is a directed edge. The advisor gives the strongest weight when a candidate perk emits a token consumed by the current build. It can also reward perks that consume a token already emitted by the build and perks that satisfy activity/build-role needs.

Missing curated evidence scores zero rather than being guessed.

## Runtime input shape

```js
{
  weapon: {
    itemHash: 123,
    itemInstanceId: "456",
    selectedPerkHashes: ["10", "20"],
    perkColumns: [
      { options: [{ hash: "10", name: "Perk A" }, { hash: "11", name: "Perk B" }] },
      { options: [{ hash: "20", name: "Perk C" }, { hash: "21", name: "Perk D" }] }
    ]
  },
  context: {
    desiredTokens: ["grenade-energy", "volatile"],
    emittedTokens: ["orb-of-power"],
    preferredRoles: ["ability-loop"],
    activityNeeds: ["add-clear"]
  }
}
```

## Output

The engine returns the highest-scoring valid combination, up to three alternatives, the directed synergy reasons, curated coverage warnings, and whether the player's current selected perks already match the recommendation.

## Equipment safety

The first implementation is recommendation-only. `remotePerkMutationSupported` is deliberately `false` until a Bungie API action is explicitly verified for the relevant item/action. The UI may later expose an Apply action only where the platform genuinely supports it; otherwise Paradox shows the exact perk combination to select in game.

## Next integration step

Once Guardian weapon socket extraction is reliable, convert the live socket/reusable-plug data into `perkColumns`, feed current build tokens from the Paradox analysis engine into `context`, and surface the result in the weapon inspector rather than crowding the main Weapons panel.
