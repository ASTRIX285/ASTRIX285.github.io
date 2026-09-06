#!/usr/bin/env python3
"""Prepare versioned, lossless public definition shards off the browser/Worker heap."""
import json, os, shutil, tempfile, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'astrix-manifest-worker/data'
LIMIT = 2 * 1024 * 1024
TYPES = (
    'InventoryItem SandboxPerk Artifact PlugSet Stat SocketCategory EquipableItemSet '
    'PresentationNode Record Objective Collectible Metric GuardianRank GuardianRankConstants '
    'Destination Activity Checklist Location SocketType DamageType BreakerType PowerCap Season SeasonPass'
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
        if index.get('schemaVersion') == 1 and index.get('manifestVersion') == version and set(index.get('tables', {})) == set(required) and all((OUT / f'pages/{page}.json').exists() for page in ('common', 'journey', 'loadout')):
            print('BACKEND_MANIFEST_CURRENT=' + version)
            return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=OUT.parent) as temp:
        staging = Path(temp) / 'data'
        staging.mkdir()
        index = {'schemaVersion': 1, 'manifestVersion': version, 'tables': {}}
        page_rows = {}
        for table in required:
            path = manifest['jsonWorldComponentContentPaths']['en'][table]
            if not path.startswith('/common/destiny2_content/json/'):
                raise ValueError('Unexpected Bungie manifest path')
            rows = fetch('https://www.bungie.net' + path)
            index['tables'][table] = shard_table(rows, staging / table)
            if table in ('DestinyActivityDefinition', 'DestinyDestinationDefinition', 'DestinySeasonDefinition', 'DestinySeasonPassDefinition'):
                page_rows[table] = rows
            print(table, index['tables'][table], flush=True)
            if table not in page_rows:
                del rows
        if sum(t['shards'] for t in index['tables'].values()) + 1 > 19000:
            raise ValueError('Backend catalogue exceeds the static asset count budget')
        # Reject a manifest change during generation rather than publish mixed data.
        if metadata()['version'] != version:
            raise ValueError('Bungie manifest changed during preparation; retry required')
        def timestamp(value):
            try:
                return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp()
            except ValueError:
                return None
        now = datetime.now(timezone.utc).timestamp()
        seasons = sorted(page_rows['DestinySeasonDefinition'].values(), key=lambda row: timestamp(row.get('startDate')) or 0, reverse=True)
        active_season = next((row for row in seasons if (timestamp(row.get('startDate')) or now + 1) <= now and (timestamp(row.get('endDate')) is None or now < timestamp(row.get('endDate')))), None)
        if not active_season:
            raise ValueError('Current season is missing from the prepared manifest')
        pass_entries = active_season.get('seasonPassList') or []
        active_pass_entry = next((row for row in pass_entries if (timestamp(row.get('seasonPassStartDate')) is None or timestamp(row.get('seasonPassStartDate')) <= now) and (timestamp(row.get('seasonPassEndDate')) is None or now < timestamp(row.get('seasonPassEndDate')))), pass_entries[-1] if pass_entries else {})
        pass_hash = str(active_pass_entry.get('seasonPassHash') or active_season.get('seasonPassHash') or '')
        season_pass = page_rows['DestinySeasonPassDefinition'].get(pass_hash)
        season_display = active_season.get('displayProperties') or {}
        pass_images = (season_pass or {}).get('images') or {}
        index['currentSeason'] = {
            'manifestVersion': version,
            'season': {
                'hash': active_season.get('hash'),
                'seasonNumber': active_season.get('seasonNumber'),
                'name': season_display.get('name') or '',
                'startDate': active_season.get('startDate'),
                'endDate': active_season.get('endDate'),
                'seasonPassProgressionHash': active_season.get('seasonPassProgressionHash'),
            },
            'pass': {
                'hash': int(pass_hash),
                'rewardProgressionHash': season_pass.get('rewardProgressionHash'),
                'prestigeProgressionHash': season_pass.get('prestigeProgressionHash'),
                'iconPath': pass_images.get('iconImagePath') or '',
                'backgroundImagePath': pass_images.get('themeBackgroundImagePath') or '',
            } if season_pass and pass_hash.isdigit() else None,
        }
        (staging / 'index.json').write_bytes(encode(index))
        forge_index = ROOT / 'astrix-app/data/forge-armour-index.json'
        forge_payload = json.loads(forge_index.read_text(encoding='utf-8'))
        if forge_payload.get('manifestVersion') != version:
            raise ValueError('Forge page bundle does not match the prepared manifest')
        pages = staging / 'pages'
        pages.mkdir()
        (pages / 'common.json').write_bytes(encode({
            'manifestVersion': version,
            'page': 'common',
            'artifactCatalog': forge_payload.get('artifactCatalog') or [],
        }))
        (pages / 'loadout.json').write_bytes(encode({
            'manifestVersion': version,
            'page': 'loadout',
            'forgeArmourIndex': forge_payload,
        }))
        journey_index_path = ROOT / 'astrix-app/data/journey-index/index.json'
        journey_index = json.loads(journey_index_path.read_text(encoding='utf-8'))
        if journey_index.get('manifestVersion') != version:
            raise ValueError('Journey page bundle does not match the prepared manifest')
        endgame = journey_index.get('endgameByDestination') or {}
        destination_hashes = set(endgame)
        activity_hashes = {str(value) for values in endgame.values() for value in values}
        (pages / 'journey.json').write_bytes(encode({
            'manifestVersion': version,
            'page': 'journey',
            'journeyIndex': {'endgameByDestination': endgame},
            'manifestTables': {
                'DestinyDestinationDefinition': {key: page_rows['DestinyDestinationDefinition'][key] for key in destination_hashes if key in page_rows['DestinyDestinationDefinition']},
                'DestinyActivityDefinition': {key: page_rows['DestinyActivityDefinition'][key] for key in activity_hashes if key in page_rows['DestinyActivityDefinition']},
            },
        }))
        if OUT.exists():
            shutil.rmtree(OUT)
        shutil.move(str(staging), OUT)
    print('BACKEND_MANIFEST_PREPARED=' + version)

if __name__ == '__main__':
    main()
