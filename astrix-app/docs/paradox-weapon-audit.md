# PARADOX weapon and Journey audit

Source: [Bungie's public manifest](https://www.bungie.net/Platform/Destiny2/Manifest/), version `244213.26.06.29.2000-1-bnet.65864`.

The committed catalogue contains every weapon in that snapshot, grouped by Bungie's weapon subtype. `../data/weapon-catalogue/index.json` lists each type, component shard, byte count and SHA-256 digest. `../data/paradox-weapon-audit-report.json` records exhaustive coverage and validation status. Coverage is snapshot coverage, not a claim about redacted or API-absent content.

| Weapon type | Weapons |
| --- | ---: |
| Auto-Rifle | 190 |
| Combat Bow | 77 |
| Fusion Rifle | 123 |
| Glaive | 40 |
| Grenade Launcher | 169 |
| Hand Cannon | 228 |
| Linear Fusion Rifle | 48 |
| Machine Gun | 85 |
| Pulse Rifle | 195 |
| Rocket Launcher | 109 |
| Scout Rifle | 159 |
| Shotgun | 177 |
| Sidearm | 141 |
| Sniper Rifle | 162 |
| Submachine Gun | 160 |
| Sword | 109 |
| Trace Rifle | 36 |
| **Total** | **2,208** |

## Identity and coverage

- 25,201 weapon sockets; 4,131 plug definitions; 4,213 plug sets; 1,885 sandbox effects; 5,432 icon definitions.
- All 1,975,754 recorded references resolve. This includes 1,905,000 weapon socket-to-plug pool references. The pool audit retains currently non-rollable and legacy definitions.
- 299 official Weapon Mods category plugs have no link from a current weapon socket pool. They remain indexed with their original hashes and are listed explicitly in the report.
- Every weapon and plug uses `paradox:bungie:DestinyInventoryItemDefinition:<hash>`. Sandbox effects, plug sets and icon definitions use their own definition-type namespace. Socket IDs append `:socket:<index>` to the weapon ID.
- `iconHash` is a genuine `DestinyIconDefinition` hash when Bungie supplies one. It is distinct from the inventory item hash. Equal names never establish identity.
- All 2,208 weapon definitions include an icon path. Bungie supplies no icon path for 23 indexed plugs and 498 indexed sandbox effect definitions. These omissions are listed; artwork is never invented. Remote image availability is separate from reference integrity.
- Archetypes retain every plug associated with intrinsic socket categories and intrinsic socket entries. They are linked by hash, including Exotic intrinsic definitions.
- Release watermark evidence is indexed for 2,208 weapons and 6,029 armour items. Rendering respects the owned item's version number, then the definition's current version, plus Bungie's explicit featured watermark. No season number is guessed from artwork.

## Card correction

Numeric Bungie socket categories take precedence over text matching. This keeps Praxic Blade's blade, grip, reversal, combo and tracker in its five perk columns. Its form and power-core upgrade remain in Weapon Mods. Mods use square tiles; perks remain circular.

Perk matrices retain every returned instance choice. Tier defaults may reserve space but cannot truncate actual alternatives. Disabled choices remain visible and cannot be recommended as insertable. Catalogue pools describe possible rolls; they do not imply that a player owns every choice. Character plug-set availability remains bound to the owning character.

## Journey data and loading

Journey now requests Collectibles (component 800) and resolves badges from `collectionBadgesRootNodeHash`. It no longer uses the title/seal tree for badges. Missing states remain unknown, invisible collectibles remain hidden, and obscured collectibles do not disclose their names.

Presentation nodes, records, objectives, collectibles and the other Journey component tables load on demand and reuse the manifest-version cache. Simultaneous requests are coalesced. Transient definition failures can retry instead of poisoning the cache. The shared manifest service remains one instance across page import versions. Normal card display does not download the complete audit catalogue.

## Validation and release gates

Local exhaustive model, reference, identity, watermark, Journey, cache, character-isolation, application regression, scope and sandbox packaging checks pass. The auth Worker passes TypeScript and Wrangler dry-run checks.

`Validate PARADOX weapon audit` runs on the isolated `paradox/weapon-audit-20260905` review branch. It repeats the regression gates, builds the Worker, renders all 17 weapon types at 320, 390, 768 and 1440 pixels, and preserves Praxic Blade screenshots. The review branch does not deploy. Sandbox is updated only after that workflow passes; the sandbox workflow repeats the application gates before deployment.

The uploaded visual references guide the correction. Local fixture rendering and authenticated in-game/profile rendering are separate checks. The current task has no verified authenticated live-profile visual result. Automatic review blocked transmitting the unpublished preview to the cloud browser, so visual tests run in this repository's GitHub Actions environment.

Progress updates use six explicit gates: catalogue, card implementation, Journey implementation, local regression, browser regression and sandbox deployment. The machine-readable report records the completed gates. These percentages measure gates completed, not estimated remaining time. Scheduled updates stop at 10am UK time on 5 September 2026.

## Reproduce or refresh

```sh
python3 astrix-app/tools/build-weapon-catalogue.py --download
node astrix-app/tools/test-weapon-catalogue.mjs --record
node astrix-app/tools/paradox-validator.mjs
node astrix-app/tools/validate-sandbox-deployment.mjs
```

The generator also accepts `--sqlite FILE --metadata FILE` for a pinned snapshot. New Bungie snapshots must pass these gates before replacing the reviewed catalogue. A manifest refresh may change totals; fixed historical counts are not used to manufacture a pass. Live Journey/profile definitions continue to use the current Bungie manifest independently of this committed audit snapshot.
