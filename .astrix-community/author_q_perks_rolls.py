import json, urllib.request, sqlite3, zipfile, io, gzip, copy
from pathlib import Path
ROOT=Path('.')
DATA=ROOT/'astrix-app/data/paradox-forge/beta'
FIX=DATA/'ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json'
CACHE=DATA/'beta-bungie-manifest-cache.json'
GUIDES={
'PF-COMM-01':'https://mobalytics.gg/destiny-2/profile/deadly-crown-jhp9vc/builds/8e39761f-b025-466d-8e4f-44304acda210',
'PF-COMM-04':'https://mobalytics.gg/destiny-2/builds/titan/stasis/rickkackis-nuclear-bomb-shatters',
'PF-COMM-32':'https://mobalytics.gg/destiny-2/builds/hunter/stasis/itztizzle-renewal-grasps-perfected'}
ROLLS={
'PF-COMM-01':{3796682229:[(3700496672,'trait1'),(3038247973,'trait2')]},
'PF-COMM-04':{1419158093:[(3932949589,'trait1'),(365154968,'trait2')],3489054606:[(4293542123,'trait1'),(557221067,'trait2')]},
'PF-COMM-32':{3381450498:[(1556840489,'trait1'),(2173046394,'trait2')],3568377122:[(3523296417,'trait1'),(3194351027,'trait2')]}}
PERK_NAMES={3700496672:'Shoot to Loot',3038247973:'Explosive Payload',3932949589:'Cooling Baubles',365154968:'Target Lock',4293542123:'Incandescent',557221067:'Killing Tally',1556840489:'Lead from Gold',2173046394:'Voltshot',3523296417:'Demolitionist',3194351027:'Explosive Light'}

def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
 with urllib.request.urlopen(req,timeout=120) as r:return r.read()
def signed(h): return h if h<2**31 else h-2**32
fixtures=json.loads(FIX.read_text())
if isinstance(fixtures,dict): arr=fixtures.get('fixtures',[])
else: arr=fixtures
before=copy.deepcopy(arr)
byid={f['fixtureId']:f for f in arr}
# hash-match gate and author only rollPerks on equipped weapons
for fid,weapons in ROLLS.items():
 f=byid[fid]; equipped=f.get('rawDim',{}).get('equipped',[])
 eqhashes={int(x.get('hash',x.get('itemHash',-1))) for x in equipped}
 for wh,perks in weapons.items():
  if wh not in eqhashes: raise RuntimeError(f'{fid} weapon hash {wh} not equipped')
  row=next(x for x in equipped if int(x.get('hash',x.get('itemHash',-1)))==wh)
  row['rollPerks']=[{'perkHash':ph,'socket':sock,'sourceUrl':GUIDES[fid]} for ph,sock in perks]
# invariant: stripping rollPerks restores byte-equivalent canonical fixture objects
for old,new in zip(before,arr):
 chk=copy.deepcopy(new)
 for w in chk.get('rawDim',{}).get('equipped',[]): w.pop('rollPerks',None)
 old2=copy.deepcopy(old)
 for w in old2.get('rawDim',{}).get('equipped',[]): w.pop('rollPerks',None)
 if chk!=old2: raise RuntimeError(f'non-rollPerks drift in {new.get("fixtureId")}')
# resolve every authored perk against live Bungie manifest and append missing cache definitions
meta=json.loads(get('https://www.bungie.net/Platform/Destiny2/Manifest/').decode())['Response']
mp=meta['mobileWorldContentPaths']['en']; payload=get('https://www.bungie.net'+mp); db=Path('/tmp/world.content')
if payload[:2]==b'PK':
 with zipfile.ZipFile(io.BytesIO(payload)) as z: db.write_bytes(z.read([n for n in z.namelist() if not n.endswith('/')][0]))
elif payload[:2]==b'\x1f\x8b': db.write_bytes(gzip.decompress(payload))
else: db.write_bytes(payload)
con=sqlite3.connect(str(db)); cur=con.cursor(); cache=json.loads(CACHE.read_text()); inv=cache.setdefault('inventoryItems',{}); added=[]; resolved={}
for ph in sorted({ph for ws in ROLLS.values() for ps in ws.values() for ph,_ in ps}):
 row=cur.execute('select json from DestinyInventoryItemDefinition where id=?',(signed(ph),)).fetchone()
 if not row: raise RuntimeError(f'perk {ph} unresolved in live Bungie manifest')
 d=json.loads(row[0]); dp=d.get('displayProperties') or {}; name=dp.get('name',''); desc=dp.get('description','')
 if PERK_NAMES.get(ph) and name!=PERK_NAMES[ph]: raise RuntimeError(f'perk name mismatch {ph}: {name}')
 resolved[ph]={'name':name,'description':desc}
 if str(ph) not in inv:
  inv[str(ph)]={'display':dp,'itemType':d.get('itemType'),'itemSubType':d.get('itemSubType'),'itemTypeDisplayName':d.get('itemTypeDisplayName',''),'classType':d.get('classType'),'itemCategoryHashes':d.get('itemCategoryHashes') or [],'traitIds':d.get('traitIds') or [],'equippingBlock':d.get('equippingBlock') or {},'intrinsicPlugHashes':[]}
  added.append(ph)
con.close()
FIX.write_text(json.dumps(fixtures,separators=(',',':')))
CACHE.write_text(json.dumps(cache,separators=(',',':')))
print('AUTHORED='+json.dumps({fid:{str(wh):[{'perkHash':ph,'name':resolved[ph]['name'],'socket':sock,'sourceUrl':GUIDES[fid]} for ph,sock in ps] for wh,ps in ws.items()} for fid,ws in ROLLS.items()},separators=(',',':')))
print('MANIFEST='+json.dumps({str(ph):resolved[ph] for ph in sorted(resolved)},separators=(',',':')))
print('CACHE_ADDED='+json.dumps(added))
