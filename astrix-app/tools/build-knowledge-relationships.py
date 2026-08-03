#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'astrix-app' / 'data'
CURATED = DATA / 'knowledge-relationships.curated.json'
COUNTERS = DATA / 'counter-rules.json'
OUTPUT = DATA / 'knowledge-relationships.json'


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def slug(value: Any) -> str:
    return re.sub(r'[^a-z0-9]+', '-', str(value).lower()).strip('-')


def main() -> int:
    curated_payload = load(CURATED)
    curated = curated_payload.get('relationships')
    if not isinstance(curated, list):
        raise SystemExit('knowledge-relationships.curated.json must contain a relationships array')

    counter_payload = load(COUNTERS)
    rules = counter_payload.get('rules')
    if not isinstance(rules, list):
        raise SystemExit('counter-rules.json must contain a rules array')

    generated = []
    for rule in rules:
        if not isinstance(rule, dict) or rule.get('verified') is not True:
            continue
        sources = rule.get('sources')
        if not isinstance(sources, list) or not sources:
            continue
        rule_id = str(rule.get('id') or '').strip()
        threat = str(rule.get('threat') or '').strip()
        subject = str(rule.get('subject') or '').strip()
        reasoning = str(rule.get('reasoning') or '').strip()
        if not rule_id or not threat or not subject or not reasoning:
            continue
        generated.append({
            'id': f'{rule_id}-counters-{slug(threat)}-{slug(subject)}',
            'from': {
                'namespace': 'counterRule',
                'id': rule_id,
                'label': subject,
            },
            'relation': 'counters',
            'to': {
                'namespace': 'encounter',
                'id': f'{slug(threat)}-{slug(subject)}',
                'label': f'{subject} {threat}',
            },
            'mechanism': reasoning,
            'direction': 'from-to',
            'strength': 'primary',
            'verified': True,
            'sources': sources,
            'notes': 'Generated only from an explicitly verified counter rule; no synergy inference was performed.'
        })

    combined = []
    seen = set()
    for edge in [*curated, *generated]:
        edge_id = edge.get('id') if isinstance(edge, dict) else None
        if not edge_id:
            raise SystemExit('Every curated relationship requires an id')
        if edge_id in seen:
            raise SystemExit(f'Duplicate relationship id: {edge_id}')
        seen.add(edge_id)
        combined.append(edge)

    combined.sort(key=lambda edge: edge['id'])
    payload = {
        'schemaVersion': '1.0.0',
        'generatedAt': dt.date.today().isoformat(),
        'scope': 'Paradox Forge knowledge graph',
        'relationships': combined,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({
        'curatedRelationships': len(curated),
        'generatedCounterRelationships': len(generated),
        'totalRelationships': len(combined),
    }, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
