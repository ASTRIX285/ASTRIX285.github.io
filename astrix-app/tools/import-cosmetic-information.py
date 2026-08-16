#!/usr/bin/env python3
"""Generate the Paradox Forge cosmetic-information catalogue.

Official identity and structural metadata come from Bungie's Destiny manifest.
Player ownership is intentionally not stored here; it will be overlaid after
Bungie OAuth by matching Bungie hashes and collectible hashes.

Generated kinds:
- emblem
- shader
- weaponOrnament
- exoticArmorOrnament
- universalArmorOrnament
- armorOrnament
- ornament

No gameplay effects, rankings, tiers, builds or synergy claims are generated.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CURATED_PATH = ROOT / "astrix-app" / "data" / "cosmetic-information.curated.json"
OUTPUT_PATH = ROOT / "astrix-app" / "data" / "cosmetic-information.json"

API_ROOT = "https://www.bungie.net/Platform"
BUNGIE_ROOT = "https://www.bungie.net"

DESTINY_ITEM_TYPE_EMBLEM = 14
DESTINY_ITEM_SUBTYPE_SHADER = 20
DESTINY_ITEM_SUBTYPE_ORNAMENT = 21

CLASS_NAMES = {0: "Titan", 1: "Hunter", 2: "Warlock", 3: "Any"}
RARITY_NAMES = {0: "Unknown", 1: "Basic", 2: "Common", 3: "Rare", 4: "Legendary", 5: "Exotic"}

FORBIDDEN_FIELDS = {"rank", "ranking", "tier", "score", "position", "gameplayEffect", "synergy"}


class ImportFailure(RuntimeError):
    """Raised when cosmetic import cannot continue safely."""


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def absolute_bungie_url(path: str) -> str:
    if path.startswith(("http://", "https://")):
        return path
    return f"{BUNGIE_ROOT}{path}"


def api_get_json(url: str, api_key: str | None = None) -> dict[str, Any]:
    headers = {"Accept": "application/json", "User-Agent": "ASTRIX-Paradox-Forge/2.0"}
    if api_key:
        headers["X-API-Key"] = api_key
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise ImportFailure(f"Bungie request failed with HTTP {error.code}: {url}\n{body[:500]}") from error
    except urllib.error.URLError as error:
        raise ImportFailure(f"Unable to reach Bungie: {url}: {error.reason}") from error
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ImportFailure(f"Bungie returned invalid JSON: {url}") from error
    if not isinstance(decoded, dict):
        raise ImportFailure(f"Expected a JSON object from Bungie: {url}")
    if decoded.get("ErrorCode") not in (None, 1):
        raise ImportFailure(f"Bungie API error {decoded.get('ErrorCode')}: {decoded.get('Message')}")
    return decoded


def find_forbidden_fields(value: Any, path: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key in FORBIDDEN_FIELDS:
                found.append(child_path)
            found.extend(find_forbidden_fields(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(find_forbidden_fields(child, f"{path}[{index}]"))
    return found


def load_curated_payload() -> dict[str, Any]:
    if not CURATED_PATH.exists():
        raise ImportFailure(f"Missing curated input file: {CURATED_PATH}")
    try:
        payload = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ImportFailure(f"Invalid JSON in {CURATED_PATH}: {error}") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("cosmetics"), list):
        raise ImportFailure("Curated cosmetic file must be an object containing a cosmetics array.")
    forbidden = find_forbidden_fields(payload)
    if forbidden:
        raise ImportFailure("Forbidden fields found:\n" + "\n".join(f"  - {p}" for p in forbidden))
    for index, row in enumerate(payload["cosmetics"]):
        if not isinstance(row, dict):
            raise ImportFailure(f"cosmetics[{index}] must be an object.")
        if not row.get("bungieHash") and not row.get("name"):
            raise ImportFailure(f"cosmetics[{index}] requires bungieHash or name.")
    return payload


def get_component_paths(manifest: dict[str, Any]) -> tuple[str, dict[str, str]]:
    response = manifest.get("Response")
    if not isinstance(response, dict):
        raise ImportFailure("Bungie manifest response is missing.")
    version = str(response.get("version") or "unknown")
    paths = response.get("jsonWorldComponentContentPaths", {}).get("en", {})
    wanted = (
        "DestinyInventoryItemDefinition",
        "DestinyItemCategoryDefinition",
        "DestinyCollectibleDefinition",
        "DestinyPlugSetDefinition",
        "DestinySocketTypeDefinition",
    )
    resolved = {name: paths[name] for name in wanted if isinstance(paths, dict) and paths.get(name)}
    if "DestinyInventoryItemDefinition" in resolved:
        return version, resolved
    aggregate = response.get("jsonWorldContentPaths", {}).get("en")
    if aggregate:
        return version, {"aggregate": aggregate}
    raise ImportFailure("Bungie manifest did not provide English inventory definitions.")


def load_definitions(paths: dict[str, str]) -> dict[str, dict[str, Any]]:
    names = (
        "DestinyInventoryItemDefinition",
        "DestinyItemCategoryDefinition",
        "DestinyCollectibleDefinition",
        "DestinyPlugSetDefinition",
        "DestinySocketTypeDefinition",
    )
    if "aggregate" in paths:
        aggregate = api_get_json(absolute_bungie_url(paths["aggregate"]))
        return {name: aggregate.get(name, {}) if isinstance(aggregate.get(name, {}), dict) else {} for name in names}
    result: dict[str, dict[str, Any]] = {}
    for name in names:
        path = paths.get(name)
        result[name] = api_get_json(absolute_bungie_url(path)) if path else {}
    return result


def display_name(definition: Any) -> str:
    if not isinstance(definition, dict):
        return ""
    display = definition.get("displayProperties")
    return str(display.get("name") or "").strip() if isinstance(display, dict) else ""


def category_names(item: dict[str, Any], categories: dict[str, Any]) -> list[str]:
    names: list[str] = []
    for value in item.get("itemCategoryHashes") or []:
        name = display_name(categories.get(str(value)))
        if name and name not in names:
            names.append(name)
    return names


def classify_cosmetic(item: dict[str, Any], names: list[str]) -> str | None:
    if item.get("itemType") == DESTINY_ITEM_TYPE_EMBLEM:
        return "emblem"
    if item.get("itemSubType") == DESTINY_ITEM_SUBTYPE_SHADER:
        return "shader"
    if item.get("itemSubType") != DESTINY_ITEM_SUBTYPE_ORNAMENT:
        return None

    text = " ".join([str(item.get("itemTypeDisplayName") or ""), *names]).lower()
    plug_id = str((item.get("plug") or {}).get("plugCategoryIdentifier") or "").lower()

    if "universal ornament" in text or "armor_skins" in plug_id:
        return "universalArmorOrnament"
    if "weapon ornament" in text or "weapon" in plug_id:
        return "weaponOrnament"
    if "exotic armor ornament" in text or ("exotic" in text and "armor" in text):
        return "exoticArmorOrnament"
    if "armor ornament" in text or "armor" in plug_id or "armour" in text:
        return "armorOrnament"
    return "ornament"


def collect_compatible_hashes(
    cosmetic_hash: int,
    item: dict[str, Any],
    inventory: dict[str, Any],
    plug_sets: dict[str, Any],
) -> list[int]:
    """Conservatively derive items whose sockets explicitly accept this plug."""
    compatible: set[int] = set()

    for parent_hash_text, parent in inventory.items():
        if not isinstance(parent, dict):
            continue
        sockets = parent.get("sockets")
        if not isinstance(sockets, dict):
            continue
        entries = sockets.get("socketEntries") or []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if entry.get("singleInitialItemHash") == cosmetic_hash:
                compatible.add(int(parent_hash_text))
            reusable = entry.get("reusablePlugItems") or []
            if any(isinstance(x, dict) and x.get("plugItemHash") == cosmetic_hash for x in reusable):
                compatible.add(int(parent_hash_text))
            for set_hash in (entry.get("reusablePlugSetHash"), entry.get("randomizedPlugSetHash")):
                plug_set = plug_sets.get(str(set_hash)) if set_hash else None
                plugs = plug_set.get("reusablePlugItems") if isinstance(plug_set, dict) else []
                if any(isinstance(x, dict) and x.get("plugItemHash") == cosmetic_hash for x in (plugs or [])):
                    compatible.add(int(parent_hash_text))
    return sorted(compatible)


def official_record(
    hash_text: str,
    item: dict[str, Any],
    categories: dict[str, Any],
    collectibles: dict[str, Any],
    inventory: dict[str, Any],
    plug_sets: dict[str, Any],
) -> dict[str, Any] | None:
    names = category_names(item, categories)
    kind = classify_cosmetic(item, names)
    if not kind:
        return None

    display = item.get("displayProperties") if isinstance(item.get("displayProperties"), dict) else {}
    bungie_hash = int(hash_text)
    collectible_hash = item.get("collectibleHash")
    collectible = collectibles.get(str(collectible_hash)) if collectible_hash else None
    source_hash = collectible.get("sourceHash") if isinstance(collectible, dict) else None

    compatible = []
    if "Ornament" in kind or kind == "ornament":
        compatible = collect_compatible_hashes(bungie_hash, item, inventory, plug_sets)

    return {
        "id": f"cosmetic-{bungie_hash}",
        "bungieHash": bungie_hash,
        "name": str(display.get("name") or ""),
        "cosmeticType": kind,
        "icon": str(display.get("icon") or ""),
        "watermark": str(item.get("iconWatermark") or ""),
        "secondaryIcon": str(display.get("iconSequences", [{}])[0].get("frames", [{}])[0].get("path") or "")
            if isinstance(display.get("iconSequences"), list) and display.get("iconSequences") else "",
        "officialDescription": str(display.get("description") or ""),
        "classType": CLASS_NAMES.get(item.get("classType"), "Unknown"),
        "rarity": RARITY_NAMES.get((item.get("inventory") or {}).get("tierType"), "Unknown"),
        "collectibleHash": collectible_hash,
        "sourceHash": source_hash,
        "itemCategoryHashes": item.get("itemCategoryHashes") or [],
        "categoryNames": names,
        "compatibleItemHashes": compatible,
        "official": {
            "itemType": item.get("itemType", -1),
            "itemSubType": item.get("itemSubType", -1),
            "itemTypeDisplayName": item.get("itemTypeDisplayName") or "",
            "plug": item.get("plug"),
            "sockets": item.get("sockets"),
            "inventory": item.get("inventory"),
        },
        "curated": {
            "displayNotes": "",
            "availabilityNotes": "",
            "sources": [],
        },
        "verified": False,
    }


def normalize_name(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().replace("’", "'").split())


def merge_curated(records: list[dict[str, Any]], payload: dict[str, Any]) -> tuple[int, list[str], list[str]]:
    by_hash = {str(record["bungieHash"]): record for record in records}
    by_name: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        by_name.setdefault(normalize_name(record["name"]), []).append(record)

    matched = 0
    unresolved: list[str] = []
    ambiguous: list[str] = []
    for row in payload["cosmetics"]:
        target = by_hash.get(str(row.get("bungieHash"))) if row.get("bungieHash") is not None else None
        if target is None and row.get("name"):
            candidates = by_name.get(normalize_name(row["name"]), [])
            if len(candidates) == 1:
                target = candidates[0]
            elif len(candidates) > 1:
                ambiguous.append(str(row["name"]))
                continue
        if target is None:
            unresolved.append(str(row.get("bungieHash") or row.get("name")))
            continue

        curated = target["curated"]
        curated["displayNotes"] = str(row.get("displayNotes") or "").strip()
        curated["availabilityNotes"] = str(row.get("availabilityNotes") or "").strip()
        sources = row.get("sources") or []
        if not isinstance(sources, list):
            raise ImportFailure("Curated sources must be an array.")
        curated["sources"] = sources
        if row.get("cosmeticType"):
            target["cosmeticType"] = str(row["cosmeticType"])
        target["verified"] = bool(row.get("verified", False))
        matched += 1
    return matched, unresolved, ambiguous


def meaningful_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    result.pop("generatedAt", None)
    return result


def write_if_changed(payload: dict[str, Any]) -> bool:
    existing = None
    if OUTPUT_PATH.exists():
        try:
            existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = None
    if existing is not None and meaningful_payload(existing) == meaningful_payload(payload):
        return False
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


def set_output(name: str, value: Any) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(f"{name}={value}\n")


def main() -> int:
    curated = load_curated_payload()
    api_key = os.environ.get("BUNGIE_API_KEY")
    manifest = api_get_json(f"{API_ROOT}/Destiny2/Manifest/", api_key)
    version, paths = get_component_paths(manifest)
    defs = load_definitions(paths)

    inventory = defs["DestinyInventoryItemDefinition"]
    records: list[dict[str, Any]] = []
    for hash_text, item in inventory.items():
        if not isinstance(item, dict) or item.get("redacted") is True:
            continue
        record = official_record(
            hash_text,
            item,
            defs["DestinyItemCategoryDefinition"],
            defs["DestinyCollectibleDefinition"],
            inventory,
            defs["DestinyPlugSetDefinition"],
        )
        if record and record["name"]:
            records.append(record)

    records.sort(key=lambda r: (r["cosmeticType"], r["name"].casefold(), r["bungieHash"]))
    matched, unresolved, ambiguous = merge_curated(records, curated)
    counts: dict[str, int] = {}
    for record in records:
        counts[record["cosmeticType"]] = counts.get(record["cosmeticType"], 0) + 1

    payload = {
        "schemaVersion": "2.0.0",
        "generatedAt": utc_now(),
        "manifestVersion": version,
        "curatedDigest": digest_json(curated),
        "counts": counts,
        "cosmetics": records,
    }
    changed = write_if_changed(payload)

    set_output("manifest_version", version)
    set_output("cosmetics", len(records))
    set_output("curated", len(curated["cosmetics"]))
    set_output("matched", matched)
    set_output("unresolved", len(unresolved))
    set_output("ambiguous", len(ambiguous))
    set_output("changed", str(changed).lower())

    print(json.dumps({
        "manifestVersion": version,
        "cosmetics": len(records),
        "counts": counts,
        "curatedRows": len(curated["cosmetics"]),
        "matched": matched,
        "unresolved": unresolved,
        "ambiguous": ambiguous,
        "changed": changed,
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportFailure as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
