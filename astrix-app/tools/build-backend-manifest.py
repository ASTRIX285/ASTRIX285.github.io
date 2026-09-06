#!/usr/bin/env python3
"""Prepare versioned, lossless public definition shards off the browser/Worker heap."""
import json, os, shutil, tempfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'astrix-manifest-worker/data'
LIMIT = 2 * 1024 * 1024
TYPES = (
    'InventoryItem SandboxPerk Artifact PlugSet Stat SocketCategory EquipableItemSet '
    'PresentationNode Record Objective Collectible Metric GuardianRank GuardianRankConstants '
    'Destination Activity Checklist Location SocketType DamageType BreakerType PowerCap'
).split()

def fetch(url):
    headers = {'User-Agent': 'ASTRIX-PARADOX/Shared-Manifest'}
    if os.environ.get('BUNGIE_API_KEY'):
        headers['X-API-Key'] = os.environ['BUNGIE_API_KEY']
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
        return json.load(response)

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()

def metadata():
    url = 'https://www.bungie.net/Platform/Destiny2/Manifest/' if os.environ.get('BUNGIE_API_KEY') else 'https://auth.astrixparadox.com/bungie/manifest'
    payload = fetch(url)
    return payload.get('Response', payload)

def shard_table(rows, directory):
    count = 1
    encoded = {str(h): encode(row) for h, row in rows.items()}
    while True:
        groups = [[] for _ in range(count)]
        sizes = [2] * count
        for h, value in encoded.items():
            n = int(h) % count
            entry = encode(h) + b':' + value
            groups[n].append(entry)
            sizes[n] += len(entry) + 1
        if max(sizes) <= LIMIT:
            break
        count *= 2
        if count > 8192:
            raise ValueError('Definition shard exceeds the bounded asset budget')
    directory.mkdir(parents=True)
    for n, entries in enumerate(groups):
        (directory / f'{n}.json').write_bytes(b'{' + b','.join(entries) + b'}')
    return {'shards': count, 'definitions': len(rows), 'maxShardBytes': max(sizes)}

def main():
    manifest = metadata()
    version = manifest['version']
    required = ['Destiny' + name + 'Definition' for name in TYPES]
    current = OUT / 'index.json'
    if current.exists():
        index = json.loads(current.read_text())
        if index.get('schemaVersion') == 1 and index.get('manifestVersion') == version and set(index.get('tables', {})) == set(required):
            print('BACKEND_MANIFEST_CURRENT=' + version)
            return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=OUT.parent) as temp:
        staging = Path(temp) / 'data'
        staging.mkdir()
        index = {'schemaVersion': 1, 'manifestVersion': version, 'tables': {}}
        for table in required:
            path = manifest['jsonWorldComponentContentPaths']['en'][table]
            if not path.startswith('/common/destiny2_content/json/'):
                raise ValueError('Unexpected Bungie manifest path')
            rows = fetch('https://www.bungie.net' + path)
            index['tables'][table] = shard_table(rows, staging / table)
            print(table, index['tables'][table], flush=True)
            del rows
        if sum(t['shards'] for t in index['tables'].values()) + 1 > 19000:
            raise ValueError('Backend catalogue exceeds the static asset count budget')
        # Reject a manifest change during generation rather than publish mixed data.
        if metadata()['version'] != version:
            raise ValueError('Bungie manifest changed during preparation; retry required')
        (staging / 'index.json').write_bytes(encode(index))
        if OUT.exists():
            shutil.rmtree(OUT)
        shutil.move(str(staging), OUT)
    print('BACKEND_MANIFEST_PREPARED=' + version)

if __name__ == '__main__':
    main()
