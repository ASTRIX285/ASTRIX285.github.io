import json, urllib.request, urllib.parse, re, html
from pathlib import Path
DATA=Path('astrix-app/data/paradox-forge/beta')
FIX=json.loads((DATA/'ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json').read_text())
CACHE=json.loads((DATA/'beta-bungie-manifest-cache.json').read_text()).get('inventoryItems',{})
UA={'User-Agent':'Mozilla/5.0'}
def get(url):
    req=urllib.request.Request(url,headers=UA)
    with urllib.request.urlopen(req,timeout=60) as r:return r.read().decode('utf-8','replace')
def is_weapon(h):return int((CACHE.get(str(int(h))) or {}).get('itemType') or -1)==3
def name(h):return ((CACHE.get(str(int(h))) or {}).get('display') or {}).get('name') or str(h)
rows=[]
for f in FIX.get('fixtures',[]):
    if not str(f.get('fixtureId','')).startswith('PF-COMM-'):continue
    page=get(f['sourceUrl'])
    m=re.search(r'href="https://app\.destinyitemmanager\.com/loadouts\?loadout=([^"&]+)',page)
    raw=json.loads(urllib.parse.unquote_plus(html.unescape(m.group(1)))) if m else {}
    weapons=[]
    for w in raw.get('equipped',[]):
        if w.get('hash') is None or not is_weapon(w['hash']):continue
        ovs=w.get('socketOverrides') or {}
        weapons.append({'hash':int(w['hash']),'name':name(w['hash']),'socketOverrides':{str(k):int(v) for k,v in ovs.items()}})
    # DIM shared-loadout page itself carries no guide prose beyond title/name in these payloads.
    guide_fields={k:raw.get(k) for k in ['notes','description'] if raw.get(k)}
    rows.append({'fixtureId':f['fixtureId'],'sourceUrl':f['sourceUrl'],'weapons':weapons,'payloadHasWeaponSocketPlugs':any(bool(w['socketOverrides']) for w in weapons),'guideNamedRoll':False,'guideFields':guide_fields})
print('COVERAGE='+json.dumps(rows,separators=(',',':')))
print('SUMMARY='+json.dumps({'fixtures':len(rows),'withPinnedWeaponPlugs':sum(r['payloadHasWeaponSocketPlugs'] for r in rows),'withGuideNamedRoll':sum(r['guideNamedRoll'] for r in rows)},separators=(',',':')))
