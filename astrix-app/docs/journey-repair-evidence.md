# Journey data and Character alignment repair — 5 September 2026

Scope: `sandbox` only. No auth Worker, protected video, production branch, shell or ribbon changes.

## Data verification

The new regression executes the production Journey join functions against Bungie's English world manifest `244213.26.06.29.2000-1-bnet.65864`. Test profile states are synthetic; these are catalogue counts, not the owner's completion counts.

| Destination | Official record definitions resolved |
|---|---:|
| The Pale Heart | 78 |
| Neomuna | 90 |
| Europa | 80 |
| Throne World | 85 |
| Dreaming City | 99 |
| Nessus | 21 |
| European Dead Zone | 28 |
| The Moon | 76 |
| Cosmodrome | 12 |

Production pattern grouping resolves 183 pattern records across Primary, Special and Heavy, including the outer Patterns & Catalysts wrapper. The official Medals tree resolves 17 leaf categories. Triumphs and Records accept either the outer or inner profile root, and follow explicit parent references. Nested destination branches are traversed, including Cosmodrome. Destination Records displays the destination's record catalogue; Triumphs retains its type filter. Raid/dungeon catalogue entries use official activity-mode and destination hashes; entries without verified completion state are explicitly labelled unavailable.

Season Rank joins current pass hashes to account and selected-character progressions. Missing record or rank state remains unknown; it is never counted as completed. Destination loading errors are separate from genuine empty results.

## Loading and memory controls

- Journey has its own public-definition cache and does not initialise equipment manifest tables.
- Records and objectives are split into definition shards grouped by presentation branch. Only requested shards load; only requested hashes are returned to the view.
- Retained shard cache: at most eight shards and a 6 MiB **serialized-definition budget**. This is not a guarantee that total browser heap is below 6 MiB. Parsed objects, DOM, profile data and images consume additional memory.
- Concurrent requests for a shard are deduplicated. Failed downloads can be retried. A stale manifest index falls back to selective official definition requests; this fallback retains at most 768 definitions.
- Only the active destination result is retained. Rapid destination changes are serialized and queued obsolete requests are skipped.
- Patterns and Stat Trackers load on selection. Record lists render 60 rows per page; all remaining records are reachable through Previous/Next.
- Sandbox deployment checks the manifest version and regenerates the compact catalogue when the version changes.

## Character layout

The equipment stack starts in the same grid row as the left rail. The Improve My Guardian link moves below equipment, uses content width and a 44-pixel minimum target, and preserves its native Build Forge link and existing handoff.

## Verification and limits

Run `node astrix-app/tools/test-journey-records.mjs` for real-manifest mapping, production joins, unknown-state handling, retry, request deduplication and cache-budget regressions. The existing Paradox suite and sandbox contract remain required before publishing. Existing visual-contract assertions were updated for the requested alignment and versioned runtime.

The previous completion claim did not establish that the owner's authenticated Journey panels displayed correctly. This repair's automated tests do not substitute for that authenticated visual check. The available review browser is not signed into the owner's Bungie session; live account-specific completion values and the final desktop/mobile appearance still require that review.

Bungie API reference: https://bungie-net.github.io/multi/schema_Destiny-Components-Records-DestinyProfileRecordsComponent.html


## Follow-up: Patterns, Badges and responsive Forge generation (5 September)

- Patterns resolves the official 3442838224 presentation root if character crafting metadata is omitted. All 183 pattern records in this snapshot remain browsable. Unreported personal completion remains unknown, including category totals.
- Badges batches collectible resolution once across the 39 badge trees. The compact catalogue includes the 1,229 unique referenced collectibles (1,257 badge requirements including shared entries), totaling 349,043 serialized bytes across 16 shards. It excludes unrelated collection inventory; all badge references resolve in regression tests. Journey retains its existing eight-shard / 6 MiB serialized-cache ceiling.
- Build Forge retains the transferred Artifact and Super on entry. Automatic Artifact ranking on bootstrap or unrelated manual selections was removed; generation and the explicit Artifact recommendation control still rank verified choices.
- Closed Artifact, ability, aspect and fragment pickers defer their markup until opened. Fragment options are no longer silently truncated to 14.
- The deterministic subclass search now streams candidates, retains 18 ranked branches, caps analysis memoization at 512 entries, and structurally shares unchanged equipment evidence. The browser runner yields between candidates on an 8 ms scheduling budget. This is a cooperative budget, not a hard maximum for one analyser invocation. Synchronous regression and cooperative results match; an event-loop heartbeat executes during search. Changes of source build during generation discard the stale result.
- Character's left rail sizes to its contents, ending after Artifact. Weapon and armour portrait frames use equal widths and a 1:1.22 shape; original Bungie art and release watermarks use matching contain geometry. Equipment mod/perk sockets share one size.

Validation uses official public snapshot definitions and synthetic profile progress. Authenticated Guardian visual review and full-device heap/latency measurements remain unverified; source-level layout validation is not a substitute for that review.
