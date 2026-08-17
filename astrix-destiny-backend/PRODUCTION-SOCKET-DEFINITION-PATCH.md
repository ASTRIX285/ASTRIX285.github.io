# ASTRIX Destiny Backend — production socket-definition repair

This file documents the confirmed repair for the Cloudflare Worker named `astrix-destiny-backend` serving `auth.astrixparadox.com`.

Do **not** apply this to `astrix-worker`; that is the separate generic Bungie proxy.

## Confirmed defects

### 1. Definition hydration only covers the most recently played character

The current Worker function `activeCharacterDefinitionHashes(profile)` sorts characters by `dateLastPlayed`, selects only the first character, then gathers item hashes and socket `plugHash` values only for that character.

This explains the observed runtime behaviour: the most recently played Warlock can resolve equipment, while selecting Hunter or Titan changes the character/loadout metadata but leaves equipped item definitions unresolved.

Replace the whole function with:

```js
function equippedCharacterDefinitionHashes(profile) {
  const hashes = new Set();
  const equipmentByCharacter = profile.characterEquipment?.data || {};

  for (const equipment of Object.values(equipmentByCharacter)) {
    const items = Array.isArray(equipment?.items) ? equipment.items : [];

    for (const item of items) {
      if (Number.isInteger(item?.itemHash)) hashes.add(Number(item.itemHash));

      if (!item?.itemInstanceId) continue;
      const socketData = profile.itemComponents?.sockets?.data?.[item.itemInstanceId];
      for (const socket of socketData?.sockets || []) {
        if (Number.isInteger(socket?.plugHash) && socket.plugHash > 0) {
          hashes.add(Number(socket.plugHash));
        }
      }
    }
  }

  return [...hashes];
}
__name(equippedCharacterDefinitionHashes, "equippedCharacterDefinitionHashes");
```

Then in `profileRoute()` replace:

```js
const equippedHashes = activeCharacterDefinitionHashes(payload.Response);
```

with:

```js
const equippedHashes = equippedCharacterDefinitionHashes(payload.Response);
```

Keep the existing full-length hydration call:

```js
const definitions = await fetchInventoryDefinitions(
  equippedHashes,
  session.accessToken,
  env,
  equippedHashes.length
);
```

### 2. Definition requests can be silently dropped

`fetchInventoryDefinitions()` must retain bounded concurrency and must retry Bungie 429 / 5xx responses instead of immediately returning `null`.

Use batches of 6 and wrap the individual Bungie definition request in this retry block:

```js
let response = null;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  response = await fetch(
    `${BUNGIE_PLATFORM}/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-API-Key": env.BUNGIE_API_KEY,
        "User-Agent": "ASTRIX-PARADOX/alpha (+https://astrixparadox.com)"
      }
    }
  );

  if (response.ok) break;

  const retryable = response.status === 429 || response.status >= 500;
  if (!retryable || attempt === 3) {
    const body = await response.text().catch(() => "");
    console.warn("definition_fetch_failed", {
      hash,
      status: response.status,
      attempt,
      body
    });
    return null;
  }

  const retryAfter = Number(response.headers.get("Retry-After"));
  const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter * 1000
    : 250 * 2 ** (attempt - 1);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

const payload = await response.json().catch(() => null);
```

The resolver should continue to log `definition_response_missing` when Bungie returns a JSON body without `Response`, and should retain the existing seven-day `astrix-bungie-definitions` cache.

## Recommended diagnostic response

In `profileRoute()`, after `definitions` resolves, add:

```js
const definitionCoverage = {
  requested: equippedHashes.length,
  resolved: Object.keys(definitions).length,
  missing: equippedHashes.filter((hash) => !definitions[String(hash)])
};
```

and include `definitionCoverage` in the `/bungie/profile` JSON response. The frontend ignores unknown fields, so this is non-breaking and makes DevTools verification deterministic.

## Expected recovery after deployment

Once `payload.definitions` contains all equipped socket plug definitions, the existing frontend should be able to resolve the shared socket-dependent features without another UI rewrite:

- Super
- class / movement / melee / grenade abilities
- Aspects
- Fragments
- armour mods
- exotic intrinsic trait
- armour ornament
- shader

The existing `guardian-bungie-profile.mjs`, `guardian-gear-layout.mjs`, and `guardian-beta-runtime.mjs` already contain the extraction and rendering paths for these fields.
