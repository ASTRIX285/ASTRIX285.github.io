import json,urllib.request,sqlite3,zipfile,io,gzip
from pathlib import Path
UA={'User-Agent':'Mozilla/5.0'}
def get(url):
 req=urllib.request.Request(url,headers=UA)
 with urllib.request.urlopen(req,timeout=90) as r:return r.read()
meta=json.loads(get('https://www.bungie.net/Platform/Destiny2/Manifest/').decode())['Response']
path=meta['mobileWorldContentPaths']['en']; payload=get('https://www.bungie.net'+path); db=Path('/tmp/world.content')
if payload[:2]==b'PK':
 with zipfile.ZipFile(io.BytesIO(payload)) as z: db.write_bytes(z.read([n for n in z.namelist() if not n.endswith('/')][0]))
elif payload[:2]==b'\x1f\x8b': db.write_bytes(gzip.decompress(payload))
else: db.write_bytes(payload)
con=sqlite3.connect(str(db)); cur=con.cursor()
targets={'Demolitionist','Voltshot','Incandescent','Golden Tricorn','Repulsor Brace','Destabilizing Rounds','Headstone','Chill Clip'}
for (raw,) in cur.execute('select json from DestinyInventoryItemDefinition'):
 try:d=json.loads(raw)
 except:continue
 name=((d.get('displayProperties') or {}).get('name') or '')
 if name in targets:
  print(json.dumps({'hash':d.get('hash'),'name':name,'description':(d.get('displayProperties') or {}).get('description'),'itemType':d.get('itemType'),'itemSubType':d.get('itemSubType'),'itemTypeDisplayName':d.get('itemTypeDisplayName'),'traitIds':d.get('traitIds') or [],'plug':d.get('plug') or {}},separators=(',',':')))
