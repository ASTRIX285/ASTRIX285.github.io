#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "astrix-app" / "data"

RELATIONSHIPS = DATA / "knowledge-relationships.json"

SOURCES = {
    "component": {
        "path": DATA / "armor-3-components.json",
        "keys": ("components",),
        "prefix": None,
    },
    "gameComponent": {
        "path": DATA / "game-components.catalogue.json",
        "keys": ("components",),
        "prefix": "component",
    },
    "weapon": {
        "path": DATA / "weapon-information.catalogue.json",
        "keys": ("weapons",),
        "prefix": "weapon",
    },
    "armor": {
        "path": DATA / "armor-information.catalogue.json",
        "keys": ("armor", "armour", "items"),
        "prefix": "armor",
    },
    "build": {
        "path": DATA / "armor-3-builds.json",
        "keys": ("builds",),
        "prefix": None,
    },
    "counterRule": {
        "path": DATA / "counter-rules.json",
        "keys": ("rules",),
        "prefix": None,
    },
}


def load(path: Path) -> Any:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def records(
    payload: Any,
    keys: tuple[str, ...],
) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [
            row
            for row in payload
            if isinstance(row, dict)
        ]

    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)

            if isinstance(value, list):
                return [
                    row
                    for row in value
                    if isinstance(row, dict)
                ]

    return []


def record_id(
    row: dict[str, Any],
    prefix: str | None,
) -> str | None:
    existing = row.get("id")

    if existing not in (None, ""):
        return str(existing)

    bungie_hash = row.get("bungieHash")

    if (
        prefix
        and isinstance(bungie_hash, int)
    ):
        return f"{prefix}-{bungie_hash}"

    return None


def main() -> int:
    graph = load(RELATIONSHIPS)
    edges = graph.get("relationships")

    if not isinstance(edges, list):
        raise SystemExit(
            "knowledge-relationships.json must contain "
            "a relationships array"
        )

    indexes: dict[str, set[str]] = {}
    source_status: dict[str, dict[str, Any]] = {}

    for namespace, config in SOURCES.items():
        path: Path = config["path"]

        if not path.exists():
            indexes[namespace] = set()

            source_status[namespace] = {
                "path": str(path.relative_to(ROOT)),
                "exists": False,
                "records": 0,
            }

            continue

        rows = records(
            load(path),
            config["keys"],
        )

        ids = {
            resolved
            for row in rows
            if (
                resolved := record_id(
                    row,
                    config["prefix"],
                )
            )
            is not None
        }

        indexes[namespace] = ids

        source_status[namespace] = {
            "path": str(path.relative_to(ROOT)),
            "exists": True,
            "records": len(rows),
            "indexedIds": len(ids),
        }

    ids: set[str] = set()
    unresolved: list[str] = []

    forbidden = {
        "rank",
        "ranking",
        "tierScore",
        "score",
        "position",
    }

    for index, edge in enumerate(edges):
        if not isinstance(edge, dict):
            raise SystemExit(
                f"relationships[{index}] must be an object"
            )

        edge_id = edge.get("id")

        if not edge_id:
            raise SystemExit(
                f"relationships[{index}] has no id"
            )

        if edge_id in ids:
            raise SystemExit(
                f"duplicate relationship id: {edge_id}"
            )

        ids.add(edge_id)

        if edge.get("verified") is not True:
            raise SystemExit(
                f"{edge_id} must be verified=true"
            )

        if not edge.get("sources"):
            raise SystemExit(
                f"{edge_id} requires at least one source"
            )

        if forbidden.intersection(edge):
            raise SystemExit(
                f"{edge_id} contains forbidden ranking fields"
            )

        for side in ("from", "to"):
            ref = edge.get(side) or {}
            namespace = ref.get("namespace")
            ref_id = ref.get("id")

            if namespace in ("effect", "encounter"):
                if not ref_id:
                    unresolved.append(
                        f"{edge_id}:{side}:missing-id"
                    )

                continue

            if namespace not in indexes:
                unresolved.append(
                    f"{edge_id}:{side}:"
                    f"unknown-namespace:{namespace}"
                )

                continue

            if ref_id not in indexes[namespace]:
                unresolved.append(
                    f"{edge_id}:{side}:"
                    f"{namespace}:{ref_id}"
                )

    if unresolved:
        print("Unresolved graph references:")

        for value in unresolved:
            print(f"  - {value}")

        raise SystemExit(
            f"{len(unresolved)} unresolved "
            "graph reference(s)"
        )

    print(
        json.dumps(
            {
                "relationships": len(edges),
                "namespacesIndexed": {
                    key: len(value)
                    for key, value in indexes.items()
                },
                "sourceStatus": source_status,
                "unresolved": 0,
            },
            indent=2,
        )
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
