#!/usr/bin/env python3
"""Extract a small served catalogue from a full generated ASTRIX catalogue.

This tool does not infer effects, relationships or build value.

It includes only records that already contain explicit curated information or
are explicitly marked verified by the existing importer. The full generated
manifest catalogue remains an ephemeral CI intermediate.

Supported catalogue kinds:

* weapon
* armor
* game-component
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


FORBIDDEN_FIELDS = {
    "rank",
    "ranking",
    "tier",
    "tierScore",
    "score",
    "position",
}


class ExtractionFailure(RuntimeError):
    """Raised when a catalogue cannot be safely extracted."""


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ExtractionFailure(f"Missing input file: {path}")

    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ExtractionFailure(
            f"Invalid JSON in {path}: {error}"
        ) from error

    if not isinstance(value, dict):
        raise ExtractionFailure(
            f"Expected a JSON object in {path}"
        )

    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            value,
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def find_forbidden_fields(
    value: Any,
    path: str = "$",
) -> list[str]:
    matches: list[str] = []

    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"

            if key in FORBIDDEN_FIELDS:
                matches.append(child_path)

            matches.extend(
                find_forbidden_fields(
                    child,
                    child_path,
                )
            )

    elif isinstance(value, list):
        for index, child in enumerate(value):
            matches.extend(
                find_forbidden_fields(
                    child,
                    f"{path}[{index}]",
                )
            )

    return matches


def has_meaningful_value(value: Any) -> bool:
    if value is None:
        return False

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return bool(value.strip())

    if isinstance(value, (int, float)):
        return True

    if isinstance(value, list):
        return any(
            has_meaningful_value(item)
            for item in value
        )

    if isinstance(value, dict):
        return any(
            has_meaningful_value(child)
            for child in value.values()
        )

    return False


def is_curated_or_verified(record: dict[str, Any]) -> bool:
    if record.get("verified") is True:
        return True

    curated = record.get("curated")

    return (
        isinstance(curated, dict)
        and has_meaningful_value(curated)
    )


def copy_metadata(
    payload: dict[str, Any],
) -> dict[str, Any]:
    result: dict[str, Any] = {}

    for key, value in payload.items():
        if key in {
            "weapons",
            "armor",
            "armour",
            "items",
            "components",
            "artifacts",
        }:
            continue

        result[key] = value

    return result


def extract_records(
    payload: dict[str, Any],
    key: str,
) -> list[dict[str, Any]]:
    records = payload.get(key)

    if not isinstance(records, list):
        raise ExtractionFailure(
            f"Generated catalogue must contain a {key} array."
        )

    return [
        record
        for record in records
        if (
            isinstance(record, dict)
            and is_curated_or_verified(record)
        )
    ]


def extract_weapon_catalogue(
    payload: dict[str, Any],
) -> dict[str, Any]:
    result = copy_metadata(payload)
    result["weapons"] = extract_records(
        payload,
        "weapons",
    )
    return result


def extract_armor_catalogue(
    payload: dict[str, Any],
) -> dict[str, Any]:
    result = copy_metadata(payload)

    source_key = next(
        (
            key
            for key in ("armor", "armour", "items")
            if isinstance(payload.get(key), list)
        ),
        None,
    )

    if source_key is None:
        raise ExtractionFailure(
            "Generated armour catalogue must contain "
            "an armor, armour or items array."
        )

    result["armor"] = extract_records(
        payload,
        source_key,
    )
    return result


def extract_game_component_catalogue(
    payload: dict[str, Any],
) -> dict[str, Any]:
    result = copy_metadata(payload)

    result["components"] = extract_records(
        payload,
        "components",
    )

    artifacts = payload.get("artifacts", [])

    if not isinstance(artifacts, list):
        raise ExtractionFailure(
            "Generated game-component catalogue "
            "must contain an artifacts array."
        )

    result["artifacts"] = [
        artifact
        for artifact in artifacts
        if (
            isinstance(artifact, dict)
            and is_curated_or_verified(artifact)
        )
    ]

    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--kind",
        required=True,
        choices=(
            "weapon",
            "armor",
            "game-component",
        ),
    )

    parser.add_argument(
        "--input",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--output",
        required=True,
        type=Path,
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = load_json(args.input)

    forbidden = find_forbidden_fields(payload)

    if forbidden:
        raise ExtractionFailure(
            "Forbidden ranking fields were found:\n"
            + "\n".join(
                f"  - {path}"
                for path in forbidden
            )
        )

    if args.kind == "weapon":
        output = extract_weapon_catalogue(payload)
        count = len(output["weapons"])

    elif args.kind == "armor":
        output = extract_armor_catalogue(payload)
        count = len(output["armor"])

    else:
        output = extract_game_component_catalogue(
            payload
        )
        count = (
            len(output["components"])
            + len(output["artifacts"])
        )

    write_json(args.output, output)

    print(
        json.dumps(
            {
                "kind": args.kind,
                "input": str(args.input),
                "output": str(args.output),
                "servedRecords": count,
                "outputBytes": (
                    args.output.stat().st_size
                ),
            },
            indent=2,
        )
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
