import json, urllib.request, urllib.parse, re, html
from pathlib import Path
DATA=Path('astrix-app/data/paradox-forge/beta')
FIX=json.loads((DATA/'ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json').read_text())
CACHE=json.loads((DATA/'beta-bungie-manifest-cache.json').read_text()).get('inventoryItems',{})
UA={'User-Agent':'Mozilla/5.0'}
def get(url):
    req=urllib.request.Request(url,headers=UA)
    with urllib.request.urlopen(req,timeout=60) as r:return r.read().decode('utf-8','replace')
def name(h):return ((CACHE.get(str(int(h))) or {}).get('display') or {}).get('name') or str(h)
def is_weapon(h):return int((CACHE.get(str(int(h))) or {}).get('itemType') or -1)==3
for f in FIX.get('fixtures',[]):
    if not str(f.get('fixtureId','')).startswith('PF-COMM-'):continue
    weapons=[x for x in (f.get('rawDim',{}).get('equipped') or []) if x.get('hash') is not None and is_weapon(x['hash'])]
    if not weapons:continue
    page=get(f['sourceUrl'])
    m=re.search(r'href="https://app\.destinyitemmanager\.com/loadouts\?loadout=([^"&]+)',page)
    raw=json.loads(urllib.parse.unquote_plus(html.unescape(m.group(1)))) if m else {}
    print('FIXTURE',f['fixtureId'],f.get('displayName'),'ROOT_KEYS',sorted(raw.keys()))
    for k in ['name','notes','description','tags','parameters']:
        v=raw.get(k)
        if k=='parameters' and isinstance(v,dict):print(' ',k,'KEYS',sorted(v.keys()))
        elif v not in (None,'',[],{}):print(' ',k,repr(v)[:500])
    raw_weapons=[x for x in raw.get('equipped',[]) if x.get('hash') is not None and is_weapon(x['hash'])]
    for w in raw_weapons:
        ovs=w.get('socketOverrides') or {}
        print('  WEAPON',w['hash'],name(w['hash']),'KEYS',sorted(w.keys()),'SOCKET_OVERRIDES',[(k,v,name(v)) for k,v in ovs.items()])
