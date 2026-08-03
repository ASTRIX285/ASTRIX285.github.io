#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'astrix-app' / 'data'
RELATIONSHIPS = DATA / 'knowledge-relationships.json'

SOURCES = {
    'component': (DATA / 'armor-3-components.json', ('components',)),
    'gameComponent': (DATA / 'game-components.json', ('components',)),
    'weapon': (DATA / 'weapon-information.json', ('weapons',)),
    'armor': (DATA / 'armor-information.json', ('armor', 'armour', 'items')),
    'build': (DATA / 'armor-3-builds.json', ('builds',)),
    'counterRule': (DATA / 'counter-rules.json', ('rules',)),
}


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def records(payload: Any, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
    return []


def main() -> int:
    graph = load(RELATIONSHIPS)
    edges = graph.get('relationships')
    if not isinstance(edges, list):
        raise SystemExit('knowledge-relationships.json must contain a relationships array')

    indexes: dict[str, set[str]] = {}
    for namespace, (path, keys) in SOURCES.items():
        if not path.exists():
            indexes[namespace] = set()
            continue
        indexes[namespace] = {
            str(row['id']) for row in records(load(path), keys) if row.get('id')
        }

    ids: set[str] = set()
    unresolved: list[str] = []
    forbidden = {'rank', 'ranking', 'tierScore', 'score', 'position'}

    for index, edge in enumerate(edges):
        edge_id = edge.get('id')
        if not edge_id:
            raise SystemExit(f'relationships[{index}] has no id')
        if edge_id in ids:
            raise SystemExit(f'duplicate relationship id: {edge_id}')
        ids.add(edge_id)
        if edge.get('verified') is not True:
            raise SystemExit(f'{edge_id} must be verified=true')
        if not edge.get('sources'):
            raise SystemExit(f'{edge_id} requires at least one source')
        if forbidden.intersection(edge):
            raise SystemExit(f'{edge_id} contains forbidden ranking fields')

        for side in ('from', 'to'):
            ref = edge.get(side) or {}
            namespace = ref.get('namespace')
            ref_id = ref.get('id')
            if namespace in ('effect', 'encounter'):
                if not ref_id:
                    unresolved.append(f'{edge_id}:{side}:missing-id')
                continue
            if namespace not in indexes:
                unresolved.append(f'{edge_id}:{side}:unknown-namespace:{namespace}')
                continue
            if ref_id not in indexes[namespace]:
                unresolved.append(f'{edge_id}:{side}:{namespace}:{ref_id}')

    if unresolved:
        print('Unresolved graph references:')
        for value in unresolved:
            print(f'  - {value}')
        raise SystemExit(f'{len(unresolved)} unresolved graph reference(s)')

    print(json.dumps({
        'relationships': len(edges),
        'namespacesIndexed': {key: len(value) for key, value in indexes.items()},
        'unresolved': 0,
    }, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
