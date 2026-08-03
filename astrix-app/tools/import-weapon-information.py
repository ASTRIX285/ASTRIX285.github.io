#!/usr/bin/env python3
"""Build a static Paradox Forge weapon-information catalogue.

Official identity fields come from Bungie's Destiny manifest.
Curated information is read from:
  astrix-app/data/weapon-information.curated.json

Output:
  astrix-app/data/weapon-information.json

This script deliberately ignores and rejects ranking/tier fields.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CURATED_PATH = ROOT / "astrix-app/data/weapon-information.curated.json"
OUTPUT_PATH = ROOT / "astrix-app/data/weapon-information.json"

API_ROOT = "https://www.bungie.net/Platform"
BUNGIE_ROOT = "https://www.bungie.net"

# Destiny itemType 3 is Weapon.
DESTINY_ITEM_TYPE_WEAPON = 3

# Destiny ammoType values in DestinyInventoryItemDefinition.equippingBlock.ammoType.
AMMO_TYPES = {
    1: "Primary",
    2: "Special",
    3: "Power",
}

FORBIDDEN_CURATED_FIELDS = {"rank", "ranking", "tier", "score", "position"}


def api_get_json(url: str, api_key: str | None = None) -> dict[str, Any]:
    headers = {"User-Agent": "ASTRIX-Paradox-Forge/1.0"}
    if api_key:
        headers["X-API-Key"] = api_key
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def slugify(value: str) -> str:
    value = value.lower().replace("’", "'")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "unknown"


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower().replace("’", "'"))


def load_curated() -> list[dict[str, Any]]:
    if not CURATED_PATH.exists():
        raise SystemExit(f"Missing curated input: {CURATED_PATH}")
    payload = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    rows = payload.get("weapons")
    if not isinstance(rows, list):
        raise SystemExit("weapon-information.curated.json must contain a weapons array")

    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise SystemExit(f"Curated weapon at index {index} must be an object")
        forbidden = FORBIDDEN_CURATED_FIELDS.intersection(row)
        if forbidden:
            raise SystemExit(
                f"Curated weapon {row.get('name', index)!r} contains forbidden ranking fields: "
                f"{sorted(forbidden)}"
            )
        if not row.get("name") and not row.get("bungieHash"):
            raise SystemExit(f"Curated weapon at index {index} needs name or bungieHash")
    return rows


def manifest_inventory_path(manifest: dict[str, Any]) -> tuple[str, str]:
    response = manifest.get("Response") or {}
    version = str(response.get("version") or "unknown")
    component_paths = (
        response.get("jsonWorldComponentContentPaths", {})
        .get("en", {})
    )
    path = component_paths.get("DestinyInventoryItemDefinition")
    if path:
        return version, path

    aggregate = response.get("jsonWorldContentPaths", {}).get("en")
    if aggregate:
        return version, aggregate

    raise SystemExit("Bungie manifest did not return an English inventory path")


def official_weapon(hash_text: str, item: dict[str, Any]) -> dict[str, Any]:
    display = item.get("displayProperties") or {}
    equip = item.get("equippingBlock") or {}
    ammo_type = AMMO_TYPES.get(equip.get("ammoType"), "Unknown")

    return {
        "id": f"weapon-{slugify(display.get('name', 'unknown'))}",
        "bungieHash": int(hash_text),
        "name": display.get("name", ""),
        "icon": display.get("icon", ""),
        "watermark": item.get("iconWatermark", ""),
        "weaponType": item.get("itemTypeDisplayName", ""),
        "frame": None,
        "element": None,
        "ammoType": ammo_type,
        "season": None,
        "source": None,
        "officialDescription": display.get("description", ""),
        "official": {
            "itemType": item.get("itemType", -1),
            "itemSubType": item.get("itemSubType", -1),
            "itemCategoryHashes": item.get("itemCategoryHashes", []),
            "defaultDamageTypeHash": item.get("defaultDamageTypeHash"),
            "equippingBlock": item.get("equippingBlock"),
            "sockets": item.get("sockets"),
        },
        "curated": {
            "recommendedConfiguration": {},
            "usageNotes": "",
            "loopContribution": [],
            "stunValue": None,
            "ammoValue": None,
            "shieldValue": None,
            "chargeValue": None,
            "impactValue": None,
            "sources": [],
        },
        "verified": False,
    }


def curated_block(row: dict[str, Any]) -> dict[str, Any]:
    configuration = row.get("recommendedConfiguration") or {}
    return {
        "recommendedConfiguration": {
            key: value
            for key, value in configuration.items()
            if key in {
                "barrel", "magazine", "battery", "blade", "guard",
                "masterwork", "perk1", "perk2", "originTrait"
            }
        },
        "usageNotes": row.get("usageNotes", ""),
        "loopContribution": row.get("loopContribution", []),
        "stunValue": row.get("stunValue"),
        "ammoValue": row.get("ammoValue"),
        "shieldValue": row.get("shieldValue"),
        "chargeValue": row.get("chargeValue"),
        "impactValue": row.get("impactValue"),
        "sources": row.get("sources", []),
    }


def merge_curated(record: dict[str, Any], row: dict[str, Any]) -> None:
    record["frame"] = row.get("frame")
    record["element"] = row.get("element")
    record["season"] = row.get("season")
    record["source"] = row.get("source")
    record["curated"] = curated_block(row)
    record["verified"] = bool(row.get("verified", False))


def main() -> int:
    api_key = os.environ.get("BUNGIE_API_KEY")
    if not api_key:
        raise SystemExit("BUNGIE_API_KEY is required")

    curated = load_curated()

    manifest = api_get_json(f"{API_ROOT}/Destiny2/Manifest/", api_key)
    version, path = manifest_inventory_path(manifest)
    content_url = path if path.startswith("http") else f"{BUNGIE_ROOT}{path}"
    raw = api_get_json(content_url)

    inventory = raw.get("DestinyInventoryItemDefinition", raw)
    records: list[dict[str, Any]] = []
    by_hash: dict[int, dict[str, Any]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}

    for hash_text, item in inventory.items():
        if item.get("itemType") != DESTINY_ITEM_TYPE_WEAPON:
            continue
        if not (item.get("displayProperties") or {}).get("name"):
            continue
        record = official_weapon(hash_text, item)
        records.append(record)
        by_hash[record["bungieHash"]] = record
        by_name.setdefault(normalize_name(record["name"]), []).append(record)

    unresolved: list[str] = []
    ambiguous: list[str] = []

    for row in curated:
        target = None
        if row.get("bungieHash"):
            target = by_hash.get(int(row["bungieHash"]))

        if target is None and row.get("name"):
            candidates = by_name.get(normalize_name(row["name"]), [])
            if len(candidates) == 1:
                target = candidates[0]
            elif len(candidates) > 1:
                ambiguous.append(row["name"])
                continue

        if target is None:
            unresolved.append(row.get("name") or str(row.get("bungieHash")))
            continue

        merge_curated(target, row)

    records.sort(key=lambda row: (row["name"].lower(), row["bungieHash"]))

    payload = {
        "schemaVersion": "1.0.0",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "manifestVersion": version,
        "weapons": records,
    }
    rendered = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"

    previous = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else ""
    changed = rendered != previous
    OUTPUT_PATH.write_text(rendered, encoding="utf-8")

    print(f"Manifest: {version}")
    print(f"Official weapons: {len(records)}")
    print(f"Curated rows: {len(curated)}")
    print(f"Unresolved curated rows: {len(unresolved)}")
    print(f"Ambiguous curated rows: {len(ambiguous)}")
    if unresolved:
        print("UNRESOLVED:", ", ".join(unresolved), file=sys.stderr)
    if ambiguous:
        print("AMBIGUOUS:", ", ".join(ambiguous), file=sys.stderr)

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as output:
            output.write(f"changed={'true' if changed else 'false'}\n")
            output.write(f"manifest_version={version}\n")
            output.write(f"weapons={len(records)}\n")
            output.write(f"curated={len(curated)}\n")
            output.write(f"unresolved={len(unresolved)}\n")
            output.write(f"ambiguous={len(ambiguous)}\n")

    # Unresolved or ambiguous names are not invented. They remain visible in CI,
    # but do not corrupt the generated catalogue.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
