import gzip
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

USER_AGENT = {'User-Agent': 'ASTRIX-Paradox-Forge/1.0'}


def fetch_bytes(url):
    request = urllib.request.Request(url, headers=USER_AGENT)
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: download-bungie-manifest.py <output-path>')
    output = Path(sys.argv[1])
    manifest = json.loads(fetch_bytes('https://www.bungie.net/Platform/Destiny2/Manifest/').decode())['Response']
    relative = manifest['mobileWorldContentPaths']['en']
    payload = fetch_bytes('https://www.bungie.net' + relative)
    if payload[:2] == b'PK':
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            names = [name for name in archive.namelist() if not name.endswith('/')]
            if len(names) != 1:
                raise RuntimeError(f'unexpected manifest archive contents: {names}')
            output.write_bytes(archive.read(names[0]))
    elif payload[:2] == bytes([31, 139]):
        output.write_bytes(gzip.decompress(payload))
    else:
        output.write_bytes(payload)
    print(f'WROTE_MANIFEST={output}')


if __name__ == '__main__':
    main()
