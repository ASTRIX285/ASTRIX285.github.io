#!/usr/bin/env python3
"""Refresh Paradox Forge live Destiny activity/event data from Bungie.

This is deliberately separate from curated Paradox intelligence.
It snapshots Bungie's current public milestones and resolves the activity and
modifier hashes against the current English manifest. If the normalized live
state has not changed, the existing snapshot is left untouched.

Requires BUNGIE_API_KEY in the environment.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "astrix-app" / "data" / "paradox-forge" / "live" / "destiny-live-activity-snapshot.json"
BUNGIE_ROOT = "https://www.bungie.net"
API_ROOT = f"{BUNGIE_ROOT}/Platform"
USER_AGENT = "ASTRIX-Paradox-Forge-Live-Activity/1.0"
MAX_ATTEMPTS = 5
RETRYABLE = {429, 500, 502, 503, 504}


def github_output(name: str, value: object) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(f"{name}={str(value).lower() if isinstance(value, bool) else value}\n")


def fetch_json(url: str, api_key: str | None = None) -> Any:
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if api_key:
        headers["X-API-Key"] = api_key
    last: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if isinstance(payload, dict) and payload.get("ErrorCode") not in (None, 1):
                raise RuntimeError(payload.get("Message") or payload.get("ErrorStatus") or "Bungie API error")
            return payload
        except urllib.error.HTTPError as error:
            last = error
            if error.code not in RETRYABLE or attempt == MAX_ATTEMPTS:
                raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last = error
            if attempt == MAX_ATTEMPTS:
                raise
        delay = 2 ** (attempt - 1)
        print(f"Bungie request failed ({attempt}/{MAX_ATTEMPTS}): {last}; retrying in {delay}s")
        time.sleep(delay)
    raise RuntimeError(f"Unable to fetch {url}: {last}")


def display(row: Any) -> dict[str, str]:
    props = row.get("displayProperties") if isinstance(row, dict) else None
    props = props if isinstance(props, dict) else {}
    return {
        "name": str(props.get("name") or ""),
        "description": str(props.get("description") or ""),
        "icon": str(props.get("icon") or ""),
    }


def load_component(paths: dict[str, Any], name: str) -> dict[str, Any]:
    path = paths.get(name)
    if not isinstance(path, str) or not path:
        return {}
    payload = fetch_json(BUNGIE_ROOT + path)
    return payload if isinstance(payload, dict) else {}


def collect_activity_rows(value: Any, activities: dict[str, Any], modifiers: dict[str, Any]) -> list[dict[str, Any]]:
    found: dict[str, dict[str, Any]] = {}

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            raw_hash = node.get("activityHash")
            if isinstance(raw_hash, int):
                key = str(raw_hash)
                definition = activities.get(key) if isinstance(activities.get(key), dict) else {}
                modifier_hashes = node.get("modifierHashes")
                if not isinstance(modifier_hashes, list):
                    modifier_hashes = node.get("activeModifierHashes")
                if not isinstance(modifier_hashes, list):
                    modifier_hashes = []
                resolved_modifiers = []
                for modifier_hash in modifier_hashes:
                    if not isinstance(modifier_hash, int):
                        continue
                    modifier_definition = modifiers.get(str(modifier_hash))
                    resolved_modifiers.append({
                        "hash": modifier_hash,
                        **display(modifier_definition),
                    })
                found[key] = {
                    "activityHash": raw_hash,
                    **display(definition),
                    "activityModeHashes": definition.get("activityModeHashes") or [],
                    "activityModeTypes": definition.get("activityModeTypes") or [],
                    "isPvP": bool(definition.get("isPvP")),
                    "recommendedLight": definition.get("lightLevel"),
                    "modifierHashes": modifier_hashes,
                    "modifiers": resolved_modifiers,
                }
            for child in node.values():
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(value)
    return sorted(found.values(), key=lambda row: (row.get("name") or "", row["activityHash"]))


def normalize_milestone(hash_value: str, live: dict[str, Any], milestone_defs: dict[str, Any], activities: dict[str, Any], modifiers: dict[str, Any]) -> dict[str, Any]:
    definition = milestone_defs.get(hash_value) if isinstance(milestone_defs.get(hash_value), dict) else {}
    return {
        "milestoneHash": int(hash_value),
        **display(definition),
        "isInGameMilestone": definition.get("isInGameMilestone"),
        "startDate": live.get("startDate"),
        "endDate": live.get("endDate"),
        "order": live.get("order"),
        "activities": collect_activity_rows(live, activities, modifiers),
        "live": live,
    }


def main() -> int:
    api_key = os.environ.get("BUNGIE_API_KEY")
    if not api_key:
        raise SystemExit("BUNGIE_API_KEY is required")

    manifest = fetch_json(f"{API_ROOT}/Destiny2/Manifest/", api_key)["Response"]
    version = str(manifest.get("version") or "unknown")
    paths = (manifest.get("jsonWorldComponentContentPaths") or {}).get("en") or {}

    milestone_defs = load_component(paths, "DestinyMilestoneDefinition")
    activities = load_component(paths, "DestinyActivityDefinition")
    modifiers = load_component(paths, "DestinyActivityModifierDefinition")

    live_payload = fetch_json(f"{API_ROOT}/Destiny2/Milestones/", api_key)
    live_rows = live_payload.get("Response") if isinstance(live_payload, dict) else None
    if not isinstance(live_rows, dict):
        raise RuntimeError("Bungie public milestones response was not an object")

    milestones = []
    for raw_hash, live in live_rows.items():
        if not str(raw_hash).isdigit() or not isinstance(live, dict):
            continue
        milestones.append(normalize_milestone(str(raw_hash), live, milestone_defs, activities, modifiers))
    milestones.sort(key=lambda row: (row.get("order") if isinstance(row.get("order"), int) else 999999, row.get("name") or "", row["milestoneHash"]))

    state = {
        "schemaVersion": "1.0.0",
        "source": "bungie-public-milestones+current-manifest",
        "manifestVersion": version,
        "milestoneCount": len(milestones),
        "milestones": milestones,
    }

    existing_state = None
    if OUTPUT.exists():
        try:
            existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
            existing_state = {key: existing.get(key) for key in state}
        except (OSError, json.JSONDecodeError):
            existing_state = None

    changed = existing_state != state
    if changed:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        output = {
            **state,
            "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        }
        OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"WROTE={OUTPUT}")
    else:
        print("LIVE_ACTIVITY_STATE_UNCHANGED")

    unique_activities = {
        activity["activityHash"]
        for milestone in milestones
        for activity in milestone.get("activities", [])
    }
    print(f"MANIFEST_VERSION={version}")
    print(f"MILESTONES={len(milestones)}")
    print(f"ACTIVITIES={len(unique_activities)}")
    print(f"CHANGED={str(changed).lower()}")
    github_output("changed", changed)
    github_output("manifest_version", version)
    github_output("milestones", len(milestones))
    github_output("activities", len(unique_activities))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
