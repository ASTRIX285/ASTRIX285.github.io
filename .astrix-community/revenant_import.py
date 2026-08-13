import json, urllib.request, urllib.parse, re, sqlite3, hashlib, html, zipfile, io, gzip
from pathlib import Path

DATA=Path('astrix-app/data/paradox-forge/beta')
FIX=DATA/'ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json'
CACHE=DATA/'beta-bungie-manifest-cache.json'
IDENT=DATA/'beta-component-identities.json'
SOURCE_DATE='2026-08-13'
LINKS=[
'https://dim.gg/6hsd5na/Stasis',
'https://dim.gg/xe6gemi/Praxic-Shatterdive-Hunter',
'https://dim.gg/mn2tt3a/Renewal-Grasps-Perfected']
IDS=['PF-COMM-30','PF-COMM-31','PF-COMM-32']
UA={'User-Agent':'Mozilla/5.0'}

def get(url):
    req=urllib.request.Request(url,headers=UA)
    with urllib.request.urlopen(req,timeout=90) as r:return r.read()
def canonical(obj):return json.dumps(obj,sort_keys=True,separators=(',',':'))
def signed(h):return h if h<2**31 else h-2**32

def comp_type(d):
    s=' '.join([str(d.get('itemTypeDisplayName','')),str((d.get('displayProperties') or {}).get('name','')),str((d.get('plug') or {}).get('plugCategoryIdentifier',''))]).lower()
    if 'super ability' in s or '.super' in s:return 'super'
    if 'class ability' in s:return 'classAbility'
    if 'movement ability' in s:return 'movementAbility'
    if 'melee ability' in s or '.melee' in s:return 'melee'
    if 'grenade' in s:return 'grenade'
    if 'aspect' in s:return 'aspect'
    if 'fragment' in s:return 'fragment'
    return None

def source_kind(d):
    t=int(d.get('itemType',0) or 0)
    return 'weapon' if t==3 else 'armor' if t==2 else 'gameComponent'

def intrinsic_hashes(d):
    out=[]
    for s in ((d.get('sockets') or {}).get('socketEntries') or []):
        h=s.get('singleInitialItemHash')
        if h:out.append(int(h))
    return out[:4]

fixtures=json.loads(FIX.read_text())
assert len(fixtures.get('fixtures',[]))==52,f"Expected immutable 52-fixture base, got {len(fixtures.get('fixtures',[]))}"
assert [x.get('fixtureId') for x in fixtures['fixtures'][-3:]]==['PF-COMM-27','PF-COMM-28','PF-COMM-29']
original_sha=hashlib.sha256(canonical(fixtures['fixtures']).encode()).hexdigest()
cache=json.loads(CACHE.read_text()); identities=json.loads(IDENT.read_text())
inv=cache.setdefault('inventoryItems',{}); idrows=identities.setdefault('identities',[])
existing_ids={int(x['bungieHash']) for x in idrows if x.get('bungieHash') is not None}

extracted=[];all_hashes=set();failures=[]
for idx,url in enumerate(LINKS):
    try:
        page=get(url).decode('utf-8','replace')
        m=re.search(r'href="https://app\.destinyitemmanager\.com/loadouts\?loadout=([^"&]+)',page)
        if not m:raise RuntimeError('DIM loadout query payload not found')
        raw=json.loads(urllib.parse.unquote_plus(html.unescape(m.group(1))))
        raw['equipped']=[{k:v for k,v in x.items() if k!='id'} for x in raw.get('equipped',[])]
        raw['unequipped']=[{k:v for k,v in x.items() if k!='id'} for x in raw.get('unequipped',[])]
        hs=set()
        for item in raw.get('equipped',[])+raw.get('unequipped',[]):
            if item.get('hash') is not None:hs.add(int(item['hash']))
            hs.update(int(v) for v in (item.get('socketOverrides') or {}).values())
        p=raw.get('parameters') or {}
        hs.update(int(v) for v in (p.get('mods') or []))
        for arr in (p.get('modsByBucket') or {}).values():hs.update(int(v) for v in (arr or []))
        hs.update(int(v) for v in (((p.get('artifactUnlocks') or {}).get('unlockedItemHashes')) or []))
        extracted.append({'fixtureId':IDS[idx],'url':url,'raw':raw,'hashes':hs}); all_hashes|=hs
    except Exception as e: failures.append({'url':url,'reason':repr(e)})
if failures:raise RuntimeError('DIM extraction failures: '+json.dumps(failures))
print('DIM_EXTRACTION='+json.dumps({'requested':3,'extracted':len(extracted),'uniqueHashes':len(all_hashes)}))

meta=json.loads(get('https://www.bungie.net/Platform/Destiny2/Manifest/').decode())['Response']
mpath=(meta.get('mobileWorldContentPaths') or {}).get('en')
if not mpath:raise RuntimeError('Bungie English mobile manifest path unavailable')
payload=get('https://www.bungie.net'+mpath); dbpath=Path('/tmp/world.content')
if payload[:2]==b'PK':
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        members=[n for n in z.namelist() if not n.endswith('/')]
        if not members:raise RuntimeError('Bungie manifest archive contained no database')
        dbpath.write_bytes(z.read(members[0]))
elif payload[:2]==b'\x1f\x8b': dbpath.write_bytes(gzip.decompress(payload))
else: dbpath.write_bytes(payload)
con=sqlite3.connect(str(dbpath));cur=con.cursor()
if 'DestinyInventoryItemDefinition' not in {r[0] for r in cur.execute("select name from sqlite_master where type='table'")}:raise RuntimeError('DestinyInventoryItemDefinition table missing')
defs={}
for h in sorted(all_hashes):
    row=cur.execute('select json from DestinyInventoryItemDefinition where id=?',(signed(h),)).fetchone()
    if row:
        try:defs[h]=json.loads(row[0])
        except Exception:pass
con.close()
unresolved=sorted(all_hashes-set(defs))
print('MANIFEST_RESOLUTION='+json.dumps({'resolved':len(defs),'unresolved':len(unresolved),'unresolvedHashes':unresolved}))

def name(h):return ((defs.get(int(h),{}).get('displayProperties') or {}).get('name') or f'Unresolved Destiny item {h}')
def desc(h):return ((defs.get(int(h),{}).get('displayProperties') or {}).get('description') or '').strip()
def ctype(h):return comp_type(defs.get(int(h),{}))

new_cache=new_id=0
for h,d in defs.items():
    if str(h) not in inv:
        inv[str(h)]={'display':d.get('displayProperties') or {},'itemType':d.get('itemType'),'itemSubType':d.get('itemSubType'),'itemTypeDisplayName':d.get('itemTypeDisplayName',''),'classType':d.get('classType'),'itemCategoryHashes':d.get('itemCategoryHashes') or [],'traitIds':d.get('traitIds') or [],'equippingBlock':d.get('equippingBlock') or {},'intrinsicPlugHashes':intrinsic_hashes(d)};new_cache+=1
    if h not in existing_ids:
        dp=d.get('displayProperties') or {}
        idrows.append({'source':'bungie-current-manifest-community-extension','sourceKind':source_kind(d),'identitySource':'bungie-current-manifest','id':f'community-manifest-{h}','bungieHash':h,'name':dp.get('name') or f'Destiny item {h}','officialDescription':dp.get('description') or '','icon':dp.get('icon') or '','componentType':comp_type(d),'class':{0:'Titan',1:'Hunter',2:'Warlock'}.get(d.get('classType'),'Unknown'),'official':{'itemType':d.get('itemType'),'itemSubType':d.get('itemSubType'),'itemTypeDisplayName':d.get('itemTypeDisplayName',''),'itemCategoryHashes':d.get('itemCategoryHashes') or [],'traitIds':d.get('traitIds') or []}})
        existing_ids.add(h);new_id+=1
print('CACHE_ADDITIONS='+json.dumps({'manifestInventoryItems':new_cache,'identityRows':new_id}))

# Conservative same-manifest producer/consumer test used in the previous community round.
PRODUCER={'slow':[r'slows? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? slow'],'freeze':[r'freezes? (?:nearby )?(?:targets|enemies|combatants)',r'freeze nearby'],'stasis shard':[r'creates? (?:a )?stasis shard',r'generate(?:s|d)? stasis shards?']}
CONSUMER={'slow':[r'slowed (?:targets|enemies|combatants)'],'freeze':[r'frozen (?:targets|enemies|combatants)',r'shatter(?:ing)? frozen'],'stasis shard':[r'collecting (?:a )?stasis shard',r'stasis shards? grant']}
def effects(h,pats):
    t=desc(h).lower();return [e for e,ps in pats.items() if any(re.search(p,t) for p in ps)]

new=[];report=[]
for rec in extracted:
    raw=rec['raw']; equipped=raw.get('equipped',[])
    subitem=max(equipped,key=lambda x:len((x.get('socketOverrides') or {})),default={})
    if len((subitem.get('socketOverrides') or {}))<5:raise RuntimeError(f"{rec['fixtureId']} subclass socketOverrides entry not identifiable")
    subhash=int(subitem['hash']); subname=name(subhash)
    class_type=raw.get('classType'); class_name={0:'Titan',1:'Hunter',2:'Warlock'}.get(class_type,'Unknown')
    element='Stasis' if subname=='Revenant' else 'Unknown'
    socket_hashes=[int(v) for v in (subitem.get('socketOverrides') or {}).values()]
    component_hashes=[h for h in socket_hashes if ctype(h) in {'super','classAbility','movementAbility','melee','grenade','aspect','fragment'}]
    chains=[];seen=set()
    for a in component_hashes:
        for eff in effects(a,PRODUCER):
            for b in component_hashes:
                if a==b or eff not in effects(b,CONSUMER):continue
                sig=(a,eff,b)
                if sig in seen:continue
                seen.add(sig)
                chains.append({'from':{'hash':a,'name':name(a),'type':ctype(a)},'to':{'hash':b,'name':name(b),'type':ctype(b)},'output':eff,'input':eff,'evidence':f'Bungie DestinyInventoryItemDefinition {a} ({name(a)}): {desc(a)} | Bungie DestinyInventoryItemDefinition {b} ({name(b)}): {desc(b)}'})
    unresolved_here=sorted(h for h in rec['hashes'] if h not in defs)
    focus=f"{chains[0]['from']['name']} supplies {chains[0]['output']} for {chains[0]['to']['name']}." if chains else 'No directed causal loop curated from current Bungie manifest descriptions; field intentionally sparse.'
    strengths=[{'statement':f"Verified directed {c['output']} relationship from {c['from']['name']} to {c['to']['name']}.",'evidence':c['evidence']} for c in chains[:3]]
    weak=[]
    if unresolved_here:weak.append({'statement':f'{len(unresolved_here)} Destiny hashes did not resolve against the current Bungie manifest; no identity or mechanic claims were made for them.','evidence':'Bungie current English mobile world manifest resolution pass on 2026-08-13.'})
    fixture={'fixtureId':rec['fixtureId'],'dimId':str(raw.get('id') or rec['url'].split('/')[3]),'displayName':raw.get('name') or rec['url'].rsplit('/',1)[-1],'className':class_name,'classType':class_type,'subclassName':subname,'element':element,'subclassHash':subhash,'itemCount':len(equipped),'modCount':len((raw.get('parameters') or {}).get('mods') or []),'artifactSeason':((raw.get('parameters') or {}).get('artifactUnlocks') or {}).get('seasonNumber'),'evidenceStatus':'Confirmed community DIM extraction' if subhash in defs else 'Community DIM extracted; subclass unresolved','source':'community-sourced','sourceUrl':rec['url'],'sourceDate':SOURCE_DATE,'evidenceNote':'Community DIM payload decoded from dim.gg; identities resolved only from Bungie current English manifest/cache.','buildFocus':focus,'synergyChains':chains,'weaponContribution':[],'activityProfile':{},'knownStrengths':strengths,'knownWeakLinks':weak,'mutationCases':[],'rawDim':raw,'allDestinyHashes':sorted(rec['hashes']),'dimPayloadStatus':'extracted'}
    new.append(fixture);report.append({'fixtureId':fixture['fixtureId'],'sourceUrl':fixture['sourceUrl'],'className':class_name,'classType':class_type,'subclassHash':subhash,'subclassName':subname,'element':element,'curatedChains':len(chains),'weaponContribution':len(fixture['weaponContribution']),'unresolvedHashes':len(unresolved_here)})

assert hashlib.sha256(canonical(fixtures['fixtures']).encode()).hexdigest()==original_sha,'Existing 52 fixtures changed before append'
assert len(new)==3 and [x['fixtureId'] for x in new]==IDS
revenants=[x for x in report if x['className']=='Hunter' and x['subclassName']=='Revenant' and x['element']=='Stasis']
if not revenants:raise RuntimeError('Gap-closing invariant failed: none of the three DIM payloads resolved to Revenant/Stasis Hunter')
fixtures['fixtures'].extend(new);fixtures['fixtureCount']=55;fixtures['successfulExtractions']=55;fixtures['failedExtractions']=0;fixtures['failures']=[];fixtures['communitySourceCount']=32;fixtures['communitySourceDate']=SOURCE_DATE
assert len(fixtures['fixtures'])==55
FIX.write_text(json.dumps(fixtures,separators=(',',':')));CACHE.write_text(json.dumps(cache,separators=(',',':')));IDENT.write_text(json.dumps(identities,separators=(',',':')))
print('ORIGINAL_52_SHA='+original_sha)
print('COMMUNITY_REPORT='+json.dumps(report))
print('REVENANT_CHECK='+json.dumps(revenants))
