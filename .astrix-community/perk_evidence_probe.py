import json,re
from pathlib import Path
p=Path('astrix-app/data/paradox-forge/beta/beta-bungie-manifest-cache.json')
inv=json.loads(p.read_text()).get('inventoryItems',{})
patterns=[r'grenade energy',r'jolt',r'scorch',r'volatile',r'weaken',r'ionic trace',r'final blows?.{0,60}(grenade|melee)',r'(grenade|melee).{0,60}final blows?']
rows=[]
for h,row in inv.items():
    d=(row.get('display') or {})
    text=(d.get('description') or '').strip()
    if not text:continue
    if any(re.search(p,text,re.I) for p in patterns):
        rows.append({'hash':int(h),'name':d.get('name'),'itemType':row.get('itemType'),'itemSubType':row.get('itemSubType'),'itemTypeDisplayName':row.get('itemTypeDisplayName'),'traitIds':row.get('traitIds') or [],'description':text})
print(json.dumps(rows[:100],indent=2))
print('COUNT',len(rows))
