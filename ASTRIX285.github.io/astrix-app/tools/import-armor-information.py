#!/usr/bin/env python3
"""Generate Paradox Forge armour information from the Bungie manifest."""

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
CURATED_PATH = ROOT / "astrix-app/data/armor-information.curated.json"
OUTPUT_PATH = ROOT / "astrix-app/data/armor-information.json"
API_ROOT = "https://www.bungie.net/Platform"
BUNGIE_ROOT = "https://www.bungie.net"
DESTINY_ITEM_TYPE_ARMOR = 2
CLASS_NAMES = {0: "Titan", 1: "Hunter", 2: "Warlock", 3: "Unknown"}
FORBIDDEN_FIELDS = {"rank", "ranking", "tier", "score", "position"}


class ImportFailure(RuntimeError):
    pass


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def normalize_name(value: str) -> str:
    return " ".join(str(value).strip().lower().replace("’", "'").split())


def absolute_url(path: str) -> str:
    return path if path.startswith("http") else f"{BUNGIE_ROOT}{path}"


def get_json(url: str, api_key: str | None = None) -> dict[str, Any]:
    headers = {"Accept": "application/json", "User-Agent": "ASTRIX-Paradox-Forge/2.0"}
    if api_key:
        headers["X-API-Key"] = api_key
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as error:
        raise ImportFailure(f"Unable to fetch Bungie JSON: {url}: {error}") from error
    if not isinstance(data, dict):
        raise ImportFailure(f"Expected JSON object: {url}")
    if data.get("ErrorCode") not in (None, 1):
        raise ImportFailure(data.get("Message") or data.get("ErrorStatus") or "Bungie API error")
    return data


def find_forbidden(value: Any, path: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key in FORBIDDEN_FIELDS:
                found.append(child_path)
            found.extend(find_forbidden(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(find_forbidden(child, f"{path}[{index}]"))
    return found


def load_curated() -> dict[str, Any]:
    if not CURATED_PATH.exists():
        raise ImportFailure(f"Missing curated file: {CURATED_PATH}")
    try:
        payload = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ImportFailure(f"Invalid curated JSON: {error}") from error
    rows = payload.get("armor") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ImportFailure("Curated armour file must contain an armor array")
    forbidden = find_forbidden(payload)
    if forbidden:
        raise ImportFailure("Forbidden ranking fields: " + ", ".join(forbidden))
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or (not row.get("name") and not row.get("bungieHash")):
            raise ImportFailure(f"armor[{index}] requires name or bungieHash")
    return payload


def manifest_paths(manifest: dict[str, Any]) -> tuple[str, dict[str, str]]:
    response = manifest.get("Response") or {}
    version = str(response.get("version") or "unknown")
    component = response.get("jsonWorldComponentContentPaths", {}).get("en", {})
    inventory = component.get("DestinyInventoryItemDefinition")
    stats = component.get("DestinyStatDefinition")
    if inventory:
        paths = {"inventory": inventory}
        if stats:
            paths["stats"] = stats
        return version, paths
    aggregate = response.get("jsonWorldContentPaths", {}).get("en")
    if aggregate:
        return version, {"aggregate": aggregate}
    raise ImportFailure("No English Bungie manifest path returned")


def load_definitions(paths: dict[str, str]) -> tuple[dict[str, Any], dict[str, Any]]:
    if "aggregate" in paths:
        aggregate = get_json(absolute_url(paths["aggregate"]))
        return (
            aggregate.get("DestinyInventoryItemDefinition", {}),
            aggregate.get("DestinyStatDefinition", {}),
        )
    inventory = get_json(absolute_url(paths["inventory"]))
    stats = get_json(absolute_url(paths["stats"])) if paths.get("stats") else {}
    return inventory, stats


def stat_name(stat_hash: int, definitions: dict[str, Any]) -> str | None:
    definition = definitions.get(str(stat_hash), {})
    name = (definition.get("displayProperties") or {}).get("name")
    return str(name).strip() if name else None


def investment_stats(item: dict[str, Any], stat_definitions: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for stat in item.get("investmentStats") or []:
        stat_hash = stat.get("statTypeHash")
        if not isinstance(stat_hash, int) or stat_hash <= 0:
            continue
        result.append({
            "statTypeHash": stat_hash,
            "name": stat_name(stat_hash, stat_definitions),
            "value": stat.get("value", 0),
            "isConditionallyActive": bool(stat.get("isConditionallyActive", False)),
        })
    return result


def armor_slot(item: dict[str, Any]) -> str:
    return str(item.get("itemTypeDisplayName") or "Unknown")


def official_record(hash_text: str, item: dict[str, Any], stat_definitions: dict[str, Any]) -> dict[str, Any]:
    display = item.get("displayProperties") or {}
    bungie_hash = int(hash_text)
    class_type = item.get("classType", 3)
    class_name = "Any" if class_type == 3 else CLASS_NAMES.get(class_type, "Unknown")
    return {
        "id": f"armor-{bungie_hash}",
        "bungieHash": bungie_hash,
        "name": str(display.get("name") or ""),
        "icon": str(display.get("icon") or ""),
        "watermark": str(item.get("iconWatermark") or ""),
        "armorSlot": armor_slot(item),
        "className": class_name,
        "rarity": str((item.get("inventory") or {}).get("tierTypeName") or ""),
        "officialDescription": str(display.get("description") or ""),
        "official": {
            "itemType": item.get("itemType", -1),
            "itemSubType": item.get("itemSubType", -1),
            "itemCategoryHashes": item.get("itemCategoryHashes", []),
            "classType": class_type,
            "equippingBlock": item.get("equippingBlock"),
            "sockets": item.get("sockets"),
            "investmentStats": investment_stats(item, stat_definitions),
            "stats": item.get("stats"),
        },
        "curated": {"setName": None, "setTags": [], "usageNotes": "", "sources": []},
        "verified": False,
    }


def clean_tags(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ImportFailure("setTags must be an array of strings")
    return list(dict.fromkeys(item.strip() for item in value if item.strip()))


def clean_sources(value: Any) -> list[dict[str, str]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ImportFailure("sources must be an array")
    result: list[dict[str, str]] = []
    for source in value:
        if not isinstance(source, dict):
            raise ImportFailure("Each source must be an object")
        title = str(source.get("title") or "").strip()
        publisher = str(source.get("publisher") or "").strip()
        date = str(source.get("date") or "").strip()
        if not title or not publisher or not date:
            raise ImportFailure("Each source requires title, publisher and date")
        cleaned = {"title": title, "publisher": publisher, "date": date}
        if source.get("url"):
            cleaned["url"] = str(source["url"]).strip()
        result.append(cleaned)
    return result


def merge_curated(record: dict[str, Any], row: dict[str, Any]) -> None:
    record["curated"] = {
        "setName": str(row.get("setName") or "").strip() or None,
        "setTags": clean_tags(row.get("setTags", [])),
        "usageNotes": str(row.get("usageNotes") or "").strip(),
        "sources": clean_sources(row.get("sources", [])),
    }
    record["verified"] = row.get("verified") is True


def meaningful(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": payload.get("schemaVersion"),
        "manifestVersion": payload.get("manifestVersion"),
        "curatedDigest": payload.get("curatedDigest"),
        "armor": payload.get("armor", []),
    }


def write_outputs(values: dict[str, Any]) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as output:
        for key, value in values.items():
            output.write(f"{key}={'true' if value is True else 'false' if value is False else value}\n")


def main() -> int:
    api_key = os.environ.get("BUNGIE_API_KEY")
    if not api_key:
        raise ImportFailure("BUNGIE_API_KEY is required")
    curated_payload = load_curated()
    curated_rows = curated_payload["armor"]
    curated_digest = digest_json(curated_rows)
    manifest = get_json(f"{API_ROOT}/Destiny2/Manifest/", api_key)
    manifest_version, paths = manifest_paths(manifest)
    inventory, stat_definitions = load_definitions(paths)

    records: list[dict[str, Any]] = []
    by_hash: dict[int, dict[str, Any]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}
    for hash_text, item in inventory.items():
        if not isinstance(item, dict) or item.get("itemType") != DESTINY_ITEM_TYPE_ARMOR:
            continue
        name = str((item.get("displayProperties") or {}).get("name") or "").strip()
        if not name:
            continue
        try:
            record = official_record(hash_text, item, stat_definitions)
        except (TypeError, ValueError):
            continue
        records.append(record)
        by_hash[record["bungieHash"]] = record
        by_name.setdefault(normalize_name(name), []).append(record)

    matched = 0
    unresolved: list[str] = []
    ambiguous: list[str] = []
    for row in curated_rows:
        target = None
        if row.get("bungieHash") not in (None, ""):
            target = by_hash.get(int(row["bungieHash"]))
        if target is None and row.get("name"):
            candidates = by_name.get(normalize_name(row["name"]), [])
            if len(candidates) == 1:
                target = candidates[0]
            elif len(candidates) > 1:
                ambiguous.append(str(row["name"]))
                continue
        if target is None:
            unresolved.append(str(row.get("name") or row.get("bungieHash")))
            continue
        merge_curated(target, row)
        matched += 1

    records.sort(key=lambda row: (row["name"].lower(), row["bungieHash"]))
    payload = {
        "schemaVersion": "1.0.0",
        "generatedAt": utc_now(),
        "manifestVersion": manifest_version,
        "curatedDigest": curated_digest,
        "armor": records,
    }
    previous = None
    if OUTPUT_PATH.exists():
        try:
            previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = None
    changed = previous is None or meaningful(previous) != meaningful(payload)
    if changed:
        OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Manifest version: {manifest_version}")
    print(f"Official armour records: {len(records)}")
    print(f"Curated rows: {len(curated_rows)}")
    print(f"Matched: {matched}; unresolved: {len(unresolved)}; ambiguous: {len(ambiguous)}")
    write_outputs({
        "changed": changed,
        "manifest_version": manifest_version,
        "armor": len(records),
        "curated": len(curated_rows),
        "matched": matched,
        "unresolved": len(unresolved),
        "ambiguous": len(ambiguous),
    })
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportFailure as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
