#!/usr/bin/env python3
"""Generate the Paradox Forge armour catalogue from Bungie's manifest."""
from __future__ import annotations
import datetime as dt, hashlib, json, os, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / 'astrix-app/data/armor-information.curated.json'
OUTPUT = ROOT / 'astrix-app/data/armor-information.json'
API = 'https://www.bungie.net/Platform'
BUNGIE = 'https://www.bungie.net'
CLASS_NAMES = {0:'Titan',1:'Hunter',2:'Warlock',3:'Unknown'}
FORBIDDEN = {'rank','ranking','tier','score','position'}


def get_json(url, key=None):
    headers={'Accept':'application/json','User-Agent':'ASTRIX-Paradox-Forge/2.0'}
    if key: headers['X-API-Key']=key
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=180) as response:
        value=json.loads(response.read().decode('utf-8'))
    if value.get('ErrorCode') not in (None,1): raise RuntimeError(value.get('Message','Bungie API error'))
    return value


def absolute(path): return path if path.startswith('http') else BUNGIE+path

def normal(value): return ' '.join(str(value).strip().lower().replace('’',"'").split())

def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def scan(value):
    if isinstance(value,dict):
        for key,child in value.items():
            if key in FORBIDDEN: raise RuntimeError(f'Forbidden field: {key}')
            scan(child)
    elif isinstance(value,list):
        for child in value: scan(child)


def main():
    key=os.environ.get('BUNGIE_API_KEY')
    if not key: raise RuntimeError('BUNGIE_API_KEY is required')
    curated=json.loads(CURATED.read_text(encoding='utf-8'))
    rows=curated.get('armor')
    if not isinstance(rows,list): raise RuntimeError('Curated file requires armor array')
    scan(curated)
    manifest=get_json(f'{API}/Destiny2/Manifest/',key)['Response']
    version=str(manifest.get('version','unknown'))
    paths=manifest.get('jsonWorldComponentContentPaths',{}).get('en',{})
    inv_path=paths.get('DestinyInventoryItemDefinition')
    stat_path=paths.get('DestinyStatDefinition')
    if inv_path:
        inventory=get_json(absolute(inv_path))
        stat_defs=get_json(absolute(stat_path)) if stat_path else {}
    else:
        aggregate=get_json(absolute(manifest['jsonWorldContentPaths']['en']))
        inventory=aggregate.get('DestinyInventoryItemDefinition',{})
        stat_defs=aggregate.get('DestinyStatDefinition',{})

    def stat_name(hash_value):
        return ((stat_defs.get(str(hash_value),{}).get('displayProperties') or {}).get('name'))

    records=[]; by_hash={}; by_name={}
    for hash_text,item in inventory.items():
        if item.get('itemType') != 2: continue
        display=item.get('displayProperties') or {}; name=str(display.get('name') or '').strip()
        if not name: continue
        h=int(hash_text); class_type=item.get('classType',3)
        stats=[]
        for stat in item.get('investmentStats') or []:
            sh=stat.get('statTypeHash')
            if isinstance(sh,int) and sh>0:
                stats.append({'statTypeHash':sh,'name':stat_name(sh),'value':stat.get('value',0),'isConditionallyActive':bool(stat.get('isConditionallyActive',False))})
        record={'id':f'armor-{h}','bungieHash':h,'name':name,'icon':str(display.get('icon') or ''),'watermark':str(item.get('iconWatermark') or ''),'armorSlot':str(item.get('itemTypeDisplayName') or 'Unknown'),'className':'Any' if class_type==3 else CLASS_NAMES.get(class_type,'Unknown'),'rarity':str((item.get('inventory') or {}).get('tierTypeName') or ''),'officialDescription':str(display.get('description') or ''),'official':{'itemType':item.get('itemType',-1),'itemSubType':item.get('itemSubType',-1),'itemCategoryHashes':item.get('itemCategoryHashes',[]),'classType':class_type,'equippingBlock':item.get('equippingBlock'),'sockets':item.get('sockets'),'investmentStats':stats,'stats':item.get('stats')},'curated':{'setName':None,'setTags':[],'usageNotes':'','sources':[]},'verified':False}
        records.append(record); by_hash[h]=record; by_name.setdefault(normal(name),[]).append(record)

    matched=unresolved=ambiguous=0
    for row in rows:
        target=by_hash.get(int(row['bungieHash'])) if row.get('bungieHash') not in (None,'') else None
        if target is None and row.get('name'):
            candidates=by_name.get(normal(row['name']),[])
            if len(candidates)==1: target=candidates[0]
            elif len(candidates)>1: ambiguous+=1; continue
        if target is None: unresolved+=1; continue
        tags=row.get('setTags',[]); sources=row.get('sources',[])
        if not isinstance(tags,list) or not isinstance(sources,list): raise RuntimeError('setTags and sources must be arrays')
        target['curated']={'setName':str(row.get('setName') or '').strip() or None,'setTags':list(dict.fromkeys(str(v).strip() for v in tags if str(v).strip())),'usageNotes':str(row.get('usageNotes') or '').strip(),'sources':sources}
        target['verified']=row.get('verified') is True; matched+=1

    records.sort(key=lambda value:(value['name'].lower(),value['bungieHash']))
    payload={'schemaVersion':'1.0.0','generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'manifestVersion':version,'curatedDigest':digest(rows),'armor':records}
    previous=json.loads(OUTPUT.read_text(encoding='utf-8')) if OUTPUT.exists() else None
    meaningful=lambda value:{k:value.get(k) for k in ('schemaVersion','manifestVersion','curatedDigest','armor')}
    changed=previous is None or meaningful(previous)!=meaningful(payload)
    if changed: OUTPUT.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Official armour records: {len(records)}')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a',encoding='utf-8') as out:
            for k,v in {'changed':changed,'manifest_version':version,'armor':len(records),'curated':len(rows),'matched':matched,'unresolved':unresolved,'ambiguous':ambiguous}.items(): out.write(f"{k}={'true' if v is True else 'false' if v is False else v}\n")

if __name__=='__main__': main()
