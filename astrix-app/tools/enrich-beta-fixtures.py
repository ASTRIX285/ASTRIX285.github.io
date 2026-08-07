#!/usr/bin/env python3
"""Enrich Paradox Forge beta fixtures from DIM shared loadouts.

Keeps Destiny hashes/socket/mod/artifact data only.
Does not infer gameplay effects, synergy, rankings, or recommendations.
"""

from __future__ import annotations

import html
import json
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BETA_DIR = ROOT / "astrix-app" / "data" / "paradox-forge" / "beta"
INPUT_PATH = BETA_DIR / "ASTRIX_Paradox_Forge_Beta_Fixture_Seed_v1.json"
OUTPUT_PATH = BETA_DIR / "ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json"

USER_AGENT = "ASTRIX-Paradox-Forge-Beta-Fixture-Builder/1.0"


class DimLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        values = dict(attrs)
        href = values.get("href")
        if href and "destinyitemmanager.com/loadouts" in href and "loadout=" in href:
            self.links.append(html.unescape(href))


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_dim_payload(share_url: str) -> dict[str, Any]:
    page = fetch_text(share_url)
    parser = DimLinkParser()
    parser.feed(page)

    if not parser.links:
        raise RuntimeError(f"DIM loadout link not found on {share_url}")

    parsed = urllib.parse.urlparse(parser.links[0])
    query = urllib.parse.parse_qs(parsed.query)
    encoded = query.get("loadout")

    if not encoded:
        raise RuntimeError("DIM loadout parameter missing")

    payload = json.loads(encoded[0])
    if not isinstance(payload, dict):
        raise RuntimeError("DIM payload is not an object")
    return payload


def int_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    return [int(item) for item in value if isinstance(item, int)]


def sanitise_item(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None

    item_hash = item.get("hash")
    if not isinstance(item_hash, int):
        return None

    result: dict[str, Any] = {"hash": item_hash}

    overrides = item.get("socketOverrides")
    if isinstance(overrides, dict):
        result["socketOverrides"] = {
            str(key): int(value)
            for key, value in overrides.items()
            if isinstance(value, int)
        }

    return result


def sanitise_items(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        cleaned = sanitise_item(item)
        if cleaned:
            result.append(cleaned)
    return result


def sanitise_mods_by_bucket(value: Any) -> dict[str, list[int]]:
    if not isinstance(value, dict):
        return {}

    result: dict[str, list[int]] = {}
    for bucket, hashes in value.items():
        cleaned = int_list(hashes)
        if cleaned:
            result[str(bucket)] = cleaned
    return result


def sanitise_artifact(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    result: dict[str, Any] = {}
    season = value.get("seasonNumber")
    if isinstance(season, int):
        result["seasonNumber"] = season

    hashes = int_list(value.get("unlockedItemHashes"))
    if hashes:
        result["unlockedItemHashes"] = hashes

    return result or None


def sanitise_parameters(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    result: dict[str, Any] = {}

    for key in ("mods", "perks"):
        values = int_list(value.get(key))
        if values:
            result[key] = values

    mods_by_bucket = sanitise_mods_by_bucket(value.get("modsByBucket"))
    if mods_by_bucket:
        result["modsByBucket"] = mods_by_bucket

    artifact = sanitise_artifact(value.get("artifactUnlocks"))
    if artifact:
        result["artifactUnlocks"] = artifact

    identifiers = value.get("inGameIdentifiers")
    if isinstance(identifiers, dict):
        cleaned = {
            str(key): int(item)
            for key, item in identifiers.items()
            if isinstance(item, int)
        }
        if cleaned:
            result["inGameIdentifiers"] = cleaned

    return result


def collect_hashes(dim: dict[str, Any]) -> list[int]:
    hashes: set[int] = set()

    for collection in ("equipped", "unequipped"):
        for item in dim.get(collection, []):
            item_hash = item.get("hash")
            if isinstance(item_hash, int):
                hashes.add(item_hash)

            overrides = item.get("socketOverrides")
            if isinstance(overrides, dict):
                for value in overrides.values():
                    if isinstance(value, int):
                        hashes.add(value)

    parameters = dim.get("parameters", {})

    for key in ("mods", "perks"):
        for value in parameters.get(key, []):
            if isinstance(value, int):
                hashes.add(value)

    for values in parameters.get("modsByBucket", {}).values():
        for value in values:
            if isinstance(value, int):
                hashes.add(value)

    artifact = parameters.get("artifactUnlocks", {})
    for value in artifact.get("unlockedItemHashes", []):
        if isinstance(value, int):
            hashes.add(value)

    return sorted(hashes)


def main() -> int:
    if not INPUT_PATH.exists():
        raise SystemExit(f"Missing seed file: {INPUT_PATH}")

    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    fixtures = payload.get("fixtures")

    if not isinstance(fixtures, list):
        raise SystemExit("Seed file must contain a fixtures array.")

    enriched: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    for index, source in enumerate(fixtures, start=1):
        fixture = dict(source)
        fixture_id = str(fixture.get("fixtureId", f"fixture-{index}"))
        url = fixture.get("sourceUrl")

        print(f"[{index}/{len(fixtures)}] {fixture_id}", flush=True)

        if not isinstance(url, str):
            fixture["dimPayloadStatus"] = "error"
            fixture["dimPayloadError"] = "Missing sourceUrl"
            failures.append({"fixtureId": fixture_id, "error": "Missing sourceUrl"})
            enriched.append(fixture)
            continue

        try:
            raw = extract_dim_payload(url)

            clean_dim = {
                "classType": raw.get("classType"),
                "equipped": sanitise_items(raw.get("equipped")),
                "unequipped": sanitise_items(raw.get("unequipped")),
                "parameters": sanitise_parameters(raw.get("parameters")),
            }

            fixture["rawDim"] = clean_dim
            fixture["allDestinyHashes"] = collect_hashes(clean_dim)
            fixture["dimPayloadStatus"] = "extracted"

        except Exception as error:
            message = str(error)
            fixture["dimPayloadStatus"] = "error"
            fixture["dimPayloadError"] = message
            failures.append({"fixtureId": fixture_id, "error": message})

        enriched.append(fixture)

    output = {
        "schemaVersion": "1.1",
        "purpose": (
            "Paradox Forge beta/development fixture library. "
            "DIM payloads are sanitised and contain no item instance IDs."
        ),
        "fixtureCount": len(enriched),
        "successfulExtractions": sum(
            1 for fixture in enriched
            if fixture.get("dimPayloadStatus") == "extracted"
        ),
        "failedExtractions": len(failures),
        "failures": failures,
        "fixtures": enriched,
    }

    OUTPUT_PATH.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print()
    print(f"Wrote: {OUTPUT_PATH}")
    print(f"Successful: {output['successfulExtractions']}")
    print(f"Failed: {output['failedExtractions']}")

    if failures:
        for failure in failures:
            print(f"- {failure['fixtureId']}: {failure['error']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
