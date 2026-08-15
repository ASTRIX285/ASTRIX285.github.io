#!/usr/bin/env python3
"""Paradox validation gate for Bungie in-game loadout identity data."""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / "astrix-app" / "pages" / "guardian-workspace-v2"
DEFINITIONS = WORKSPACE / "guardian-loadout-definitions.mjs"
RENDERER = WORKSPACE / "guardian-loadouts.mjs"
PROFILE = WORKSPACE / "guardian-bungie-profile.mjs"
STYLES = WORKSPACE / "guardian-left-panel-tune.css"
BUNGIE_ROOT = "https://www.bungie.net"
USER_AGENT = {"User-Agent": "ASTRIX-Paradox-Validator/1.0"}
COMPONENTS = {
    "names": "DestinyLoadoutNameDefinition",
    "icons": "DestinyLoadoutIconDefinition",
    "colors": "DestinyLoadoutColorDefinition",
}


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers=USER_AGENT)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def load_generated() -> dict:
    source = DEFINITIONS.read_text(encoding="utf-8")
    match = re.search(r"const LOADOUT_DEFINITIONS=(\{.*\});", source)
    if not match:
        raise AssertionError("Generated loadout definition module is not parseable")
    return json.loads(match.group(1))


def expected_rows(section: str, rows: dict) -> dict:
    compact = {}
    for raw_hash, row in rows.items():
        if row.get("redacted") or row.get("blacklisted"):
            continue
        if section == "names":
            compact[str(raw_hash)] = {"name": str(row.get("name") or "")}
        elif section == "icons":
            compact[str(raw_hash)] = {
                "iconImagePath": str(row.get("iconImagePath") or "")
            }
        else:
            compact[str(raw_hash)] = {
                "colorImagePath": str(row.get("colorImagePath") or "")
            }
    return compact


def main() -> int:
    generated = load_generated()
    manifest = fetch_json(f"{BUNGIE_ROOT}/Platform/Destiny2/Manifest/")["Response"]
    paths = manifest["jsonWorldComponentContentPaths"]["en"]

    assert generated["source"] == "bungie-current-manifest"
    assert generated["manifestVersion"] == manifest["version"]

    for section, component in COMPONENTS.items():
        official = fetch_json(f"{BUNGIE_ROOT}{paths[component]}")
        assert generated[section] == expected_rows(section, official), (
            f"{section} do not match Bungie's current manifest"
        )

    renderer = RENDERER.read_text(encoding="utf-8")
    profile = PROFILE.read_text(encoding="utf-8")
    styles = STYLES.read_text(encoding="utf-8")
    assert "const SLOT_COUNT=20" in renderer
    assert "loadoutIdentity(loadout)" in renderer
    assert "is-empty" in renderer and "EMPTY" in renderer
    assert 'event.detail?.source!=="bungie-live"' in renderer
    assert 'event.detail?.loadoutsAvailable!==true' in renderer
    assert 'renderStatus("Loadout data unavailable","unavailable")' in renderer
    assert "const loadoutsAvailable=Array.isArray(characterLoadouts?.loadouts)" in profile
    assert "hashHue" not in renderer
    assert ".guardian-loadouts-status.is-unavailable" in styles
    assert ".guardian-loadout-slot.is-empty::before" in styles
    assert ".guardian-loadout-slot.is-empty::after" in styles

    print("PARADOX_LOADOUT_VALIDATION=PASS")
    print(f"MANIFEST_VERSION={manifest['version']}")
    print(f"NAMES={len(generated['names'])}")
    print(f"ICONS={len(generated['icons'])}")
    print(f"COLORS={len(generated['colors'])}")
    print("SLOTS=20")
    print("EMPTY_SLOT_MARKER=PASS")
    print("UNAVAILABLE_IS_NOT_EMPTY=PASS")
    print("MISSING_COMPONENT_IS_NOT_EMPTY=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
