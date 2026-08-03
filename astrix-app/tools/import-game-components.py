#!/usr/bin/env python3
"""Generate one compact manifest-backed catalogue for subclasses, supers,
aspects, fragments, abilities and artifact perks.

Official identity comes from Bungie's manifest. Hand-verified effects remain in
astrix-app/data/game-components.curated.json and are never auto-invented.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "astrix-app" / "data"
CURATED_PATH = DATA / "game-components.curated.json"
OUTPUT_PATH = DATA / "game-components.json"
API_ROOT = "https://www.bungie.net/Platform"
BUNGIE_ROOT = "https://www.bungie.net"

CLASS_NAMES = {0: "Titan", 1: "Hunter", 2: "Warlock", 3: "Unknown"}
TYPE_LABELS = {
    "subclass": "subclass",
    "super": "super",
    "aspect": "aspect",
    "fragment": "fragment",
    "grenade": "grenade",
    "melee": "melee",
    "class ability": "classAbility",
    "movement ability": "movementAbility",
    "jump": "movementAbility",
}
FORBIDDEN = {"rank", "ranking", "tierScore", "score", "position"}


def fetch_json(url: str, api_key: str | None = None) -> dict[str, Any]:
    headers = {"Accept": "application/json", "User-Agent": "ASTRIX-Paradox-Forge/1.0"}
    if api_key:
        headers["X-API-Key"] = api_key
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=180) as response:
        data = json.loads(response.read().decode("utf-8"))
    if data.get("ErrorCode") not in (None, 1):
        raise RuntimeError(data.get("Message") or data.get("ErrorStatus") or "Bungie API error")
    return data


def absolute(path: str) -> str:
    return path if path.startswith("http") else f"{BUNGIE_ROOT}{path}"


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def normalize(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().replace("’", "'").split())


def find_forbidden(value: Any, path: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN:
                found.append(f"{path}.{key}")
            found.extend(find_forbidden(child, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(find_forbidden(child, f"{path}[{index}]"))
    return found


def load_curated() -> list[dict[str, Any]]:
    payload = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    rows = payload.get("components")
    if not isinstance(rows, list):
        raise RuntimeError("game-components.curated.json must contain a components array")
    forbidden = find_forbidden(payload)
    if forbidden:
        raise RuntimeError("Forbidden ranking fields: " + ", ".join(forbidden))
    return rows


def classify(item: dict[str, Any]) -> str | None:
    label = normalize(item.get("itemTypeDisplayName"))
    for text, component_type in TYPE_LABELS.items():
        if label == text or text in label:
            return component_type
    traits = " ".join(item.get("traitIds") or []).lower()
    for text, component_type in TYPE_LABELS.items():
        token = text.replace(" ", "")
        if token in traits.replace("_", "").replace(".", ""):
            return component_type
    return None


def subclass_hint(item: dict[str, Any]) -> str | None:
    text = " ".join([
        str((item.get("displayProperties") or {}).get("name") or ""),
        str((item.get("displayProperties") or {}).get("description") or ""),
        " ".join(item.get("traitIds") or []),
    ]).lower()
    for value in ("Arc", "Solar", "Void", "Stasis", "Strand", "Prismatic"):
        if value.lower() in text:
            return value
    return None


def empty_curated() -> dict[str, Any]:
    return {"effects": [], "inputs": [], "outputs": [], "limitations": [], "counterTags": [], "sources": []}


def main() -> int:
    api_key = os.environ.get("BUNGIE_API_KEY")
    if not api_key:
        raise RuntimeError("BUNGIE_API_KEY is required")

    curated_rows = load_curated()
    manifest = fetch_json(f"{API_ROOT}/Destiny2/Manifest/", api_key)
    response = manifest["Response"]
    version = str(response.get("version") or "unknown")
    paths = response.get("jsonWorldComponentContentPaths", {}).get("en", {})

    inventory_path = paths.get("DestinyInventoryItemDefinition")
    artifact_path = paths.get("DestinyArtifactDefinition")
    if not inventory_path:
        raise RuntimeError("Manifest did not provide DestinyInventoryItemDefinition")

    inventory = fetch_json(absolute(inventory_path))
    artifact_defs = fetch_json(absolute(artifact_path)) if artifact_path else {}

    artifact_membership: dict[int, dict[str, Any]] = {}
    artifacts: list[dict[str, Any]] = []
    for hash_text, definition in artifact_defs.items():
        if not isinstance(definition, dict):
            continue
        display = definition.get("displayProperties") or {}
        tiers_out = []
        for tier_index, tier in enumerate(definition.get("tiers") or [], start=1):
            hashes = []
            for column_index, entry in enumerate(tier.get("items") or [], start=1):
                item_hash = entry.get("itemHash")
                if isinstance(item_hash, int):
                    hashes.append(item_hash)
                    artifact_membership[item_hash] = {
                        "artifactHash": int(hash_text),
                        "tier": tier_index,
                        "column": column_index,
                    }
            tiers_out.append({"tier": tier_index, "itemHashes": hashes})
        name = str(display.get("name") or f"Artifact {hash_text}")
        artifacts.append({
            "id": f"artifact-{hash_text}",
            "bungieHash": int(hash_text),
            "name": name,
            "icon": str(display.get("icon") or ""),
            "tiers": tiers_out,
        })

    components: list[dict[str, Any]] = []
    by_hash: dict[int, dict[str, Any]] = {}
    by_name: dict[str, list[dict[str, Any]]] = {}

    for hash_text, item in inventory.items():
        if not isinstance(item, dict):
            continue
        item_hash = int(hash_text)
        component_type = "artifactPerk" if item_hash in artifact_membership else classify(item)
        if component_type is None:
            continue
        display = item.get("displayProperties") or {}
        name = str(display.get("name") or "").strip()
        if not name:
            continue
        class_type = item.get("classType")
        class_name = "Any" if class_type is None else CLASS_NAMES.get(class_type, "Unknown")
        record = {
            "id": f"component-{item_hash}",
            "bungieHash": item_hash,
            "name": name,
            "componentType": component_type,
            "class": class_name,
            "subclass": subclass_hint(item),
            "icon": str(display.get("icon") or ""),
            "officialDescription": str(display.get("description") or ""),
            "official": {
                "itemType": int(item.get("itemType", -1)),
                "itemSubType": int(item.get("itemSubType", -1)),
                "itemTypeDisplayName": str(item.get("itemTypeDisplayName") or ""),
                "itemCategoryHashes": item.get("itemCategoryHashes") or [],
                "traitIds": item.get("traitIds") or [],
                "sockets": item.get("sockets"),
            },
            "artifact": artifact_membership.get(item_hash),
            "curated": empty_curated(),
            "verified": False,
        }
        components.append(record)
        by_hash[item_hash] = record
        by_name.setdefault(normalize(name), []).append(record)

    unresolved = 0
    ambiguous = 0
    matched = 0
    for row in curated_rows:
        target = None
        if row.get("bungieHash") not in (None, ""):
            target = by_hash.get(int(row["bungieHash"]))
        if target is None and row.get("name"):
            candidates = by_name.get(normalize(row["name"]), [])
            if len(candidates) == 1:
                target = candidates[0]
            elif len(candidates) > 1:
                ambiguous += 1
                continue
        if target is None:
            unresolved += 1
            continue
        for key in ("effects", "inputs", "outputs", "limitations", "counterTags", "sources"):
            value = row.get(key, [])
            if not isinstance(value, list):
                raise RuntimeError(f"Curated {key} must be an array")
            target["curated"][key] = value
        target["verified"] = row.get("verified") is True
        matched += 1

    components.sort(key=lambda row: (row["componentType"], row["name"].lower(), row["bungieHash"]))
    artifacts.sort(key=lambda row: (row["name"].lower(), row["bungieHash"]))
    payload = {
        "schemaVersion": "1.0.0",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "manifestVersion": version,
        "curatedDigest": digest(curated_rows),
        "components": components,
        "artifacts": artifacts,
    }
    previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8")) if OUTPUT_PATH.exists() else None
    meaningful = {key: payload[key] for key in ("schemaVersion", "manifestVersion", "curatedDigest", "components", "artifacts")}
    previous_meaningful = ({key: previous.get(key) for key in meaningful} if isinstance(previous, dict) else None)
    changed = meaningful != previous_meaningful
    if changed:
        OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Official game components: {len(components)}")
    print(f"Artifacts: {len(artifacts)}")
    print(f"Curated matched: {matched}")
    print(f"Curated unresolved: {unresolved}")
    print(f"Curated ambiguous: {ambiguous}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"changed={'true' if changed else 'false'}\n")
            output.write(f"manifest_version={version}\n")
            output.write(f"components={len(components)}\n")
            output.write(f"artifacts={len(artifacts)}\n")
            output.write(f"matched={matched}\n")
            output.write(f"unresolved={unresolved}\n")
            output.write(f"ambiguous={ambiguous}\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
