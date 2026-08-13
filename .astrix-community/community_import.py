import json, urllib.request, urllib.parse, re, sqlite3, hashlib, html, zipfile, io, gzip
from pathlib import Path

DATA=Path('astrix-app/data/paradox-forge/beta')
FIX=DATA/'ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json'
CACHE=DATA/'beta-bungie-manifest-cache.json'
IDENT=DATA/'beta-component-identities.json'
SOURCE_DATE='2026-08-13'
LINKS=[
'https://dim.gg/oyx3bsa/SUPER-EASY-Bolt-Charge-Titan',
'https://dim.gg/szjarri/MOT-Prismatic-Melee-DPS-Build',
'https://dim.gg/wkzlwmq/1-End-Game-Titan-No-Back-Up-Plans-Slayer',
'https://dim.gg/ycztcty/SHATTER-EVERYTHING-Stasis-Titan',
"https://dim.gg/mpr7yny/D2Nova's-Unkillable-Frontline-Tank",
'https://dim.gg/jrfyp7y/MOT-Titan-Strand-Melee-DPS-Build',
"https://dim.gg/63ykeda/Dragon's-Blade",
'https://dim.gg/pcc2zfa/Wormgod-Strand-Titan',
'https://dim.gg/ufbro7i/Howl-of-the-Storm-Stasis-Syntho',
'https://dim.gg/2yynpji/MOT-Arc-Thundercrash-Ability-Build',
'https://dim.gg/2qldf2y/MOT-Solar-Ability-DPS-Build',
'https://dim.gg/r472cdi/God-Mode-Prismatic-Titan',
'https://dim.gg/yl4dbga/1-Blinding-Warlock',
'https://dim.gg/3whj4qa/1-Amazing-Buddy-Build-Warlock',
'https://dim.gg/fyurggy/1-Dark-Blink-Insanity',
'https://dim.gg/zts4l3i/Deimosu-God',
'https://dim.gg/qdsc3pa/Void-Osmio-Godlock',
'https://dim.gg/4tbq2ga/1-Nova-Nuke-Warlock',
'https://dim.gg/kgvzbua/Fire-and-Ice-Warlock',
'https://dim.gg/fijmlwy/Strand',
'https://dim.gg/cywwnii/1-Amazing-Dragon-Hunter',
'https://dim.gg/vono5wi/1-GM-Prismatic-Hunter',
'https://dim.gg/oou73zy/1-Crackshot-Hunter',
'https://dim.gg/fx266jy/1-Strand-Hunter-Build',
'https://dim.gg/dcp7ani/A-Shadow-Hunter',
'https://dim.gg/q66yigi/Praxic-Stinger',
"https://dim.gg/gtrj65a/Slayer's-Fang-Hunter",
'https://dim.gg/jrroq5a/Prismatic-Sting',
'https://dim.gg/delilmq/Unreal-Prismatic-Hunter']
assert len(LINKS)==29 and len(set(LINKS))==29
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
assert len(fixtures.get('fixtures',[]))==23,f"Expected immutable 23-fixture base, got {len(fixtures.get('fixtures',[]))}"
original_sha=hashlib.sha256(canonical(fixtures['fixtures']).encode()).hexdigest()
cache=json.loads(CACHE.read_text())
identities=json.loads(IDENT.read_text())
inv=cache.setdefault('inventoryItems',{})
idrows=identities.setdefault('identities',[])
existing_ids={int(x['bungieHash']) for x in idrows if x.get('bungieHash') is not None}

extracted=[];failures=[];all_hashes=set()
for idx,url in enumerate(LINKS,1):
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
        extracted.append({'index':idx,'url':url,'raw':raw,'hashes':hs});all_hashes|=hs
    except Exception as e:failures.append({'url':url,'reason':repr(e)})
if failures:raise RuntimeError('DIM extraction failures: '+json.dumps(failures))
print('DIM_EXTRACTION='+json.dumps({'requested':29,'extracted':len(extracted),'uniqueHashes':len(all_hashes)}))

meta=json.loads(get('https://www.bungie.net/Platform/Destiny2/Manifest/').decode())['Response']
mpath=(meta.get('mobileWorldContentPaths') or {}).get('en')
if not mpath:raise RuntimeError('Bungie English mobile manifest path unavailable')
payload=get('https://www.bungie.net'+mpath)
dbpath=Path('/tmp/world.content')
if payload[:2]==b'PK':
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        members=[n for n in z.namelist() if not n.endswith('/')]
        if not members:raise RuntimeError('Bungie manifest archive contained no database')
        dbpath.write_bytes(z.read(members[0]))
elif payload[:2]==b'\x1f\x8b':dbpath.write_bytes(gzip.decompress(payload))
else:dbpath.write_bytes(payload)
con=sqlite3.connect(str(dbpath));cur=con.cursor()
tables={r[0] for r in cur.execute("select name from sqlite_master where type='table'")}
if 'DestinyInventoryItemDefinition' not in tables:raise RuntimeError('DestinyInventoryItemDefinition table missing')
defs={}
for h in sorted(all_hashes):
    row=cur.execute('select json from DestinyInventoryItemDefinition where id=?',(signed(h),)).fetchone()
    if row:
        try:defs[h]=json.loads(row[0])
        except Exception:pass
con.close()
unresolved=sorted(all_hashes-set(defs))
print('MANIFEST_RESOLUTION='+json.dumps({'resolved':len(defs),'unresolved':len(unresolved),'unresolvedHashes':unresolved}))

new_cache=new_id=0
for h,d in defs.items():
    if str(h) not in inv:
        inv[str(h)]={'display':d.get('displayProperties') or {},'itemType':d.get('itemType'),'itemSubType':d.get('itemSubType'),'itemTypeDisplayName':d.get('itemTypeDisplayName',''),'classType':d.get('classType'),'itemCategoryHashes':d.get('itemCategoryHashes') or [],'traitIds':d.get('traitIds') or [],'equippingBlock':d.get('equippingBlock') or {},'intrinsicPlugHashes':intrinsic_hashes(d)};new_cache+=1
    if h not in existing_ids:
        dp=d.get('displayProperties') or {}
        idrows.append({'source':'bungie-current-manifest-community-extension','sourceKind':source_kind(d),'identitySource':'bungie-current-manifest','id':f'community-manifest-{h}','bungieHash':h,'name':dp.get('name') or f'Destiny item {h}','officialDescription':dp.get('description') or '','icon':dp.get('icon') or '','componentType':comp_type(d),'class':{0:'Titan',1:'Hunter',2:'Warlock'}.get(d.get('classType'),'Unknown'),'official':{'itemType':d.get('itemType'),'itemSubType':d.get('itemSubType'),'itemTypeDisplayName':d.get('itemTypeDisplayName',''),'itemCategoryHashes':d.get('itemCategoryHashes') or [],'traitIds':d.get('traitIds') or []}})
        existing_ids.add(h);new_id+=1
print('CACHE_ADDITIONS='+json.dumps({'manifestInventoryItems':new_cache,'identityRows':new_id}))

CLASS={0:'Titan',1:'Hunter',2:'Warlock'}
ELEMENT={'Striker':'Arc','Sentinel':'Void','Sunbreaker':'Solar','Behemoth':'Stasis','Berserker':'Strand','Arcstrider':'Arc','Nightstalker':'Void','Gunslinger':'Solar','Revenant':'Stasis','Threadrunner':'Strand','Stormcaller':'Arc','Voidwalker':'Void','Dawnblade':'Solar','Shadebinder':'Stasis','Broodweaver':'Strand'}
def name(h):return ((defs.get(int(h),{}).get('displayProperties') or {}).get('name') or f'Unresolved Destiny item {h}')
def desc(h):return ((defs.get(int(h),{}).get('displayProperties') or {}).get('description') or '').strip()
def ctype(h):return comp_type(defs.get(int(h),{}))
def element_for(n):return 'Prismatic' if 'Prismatic' in n else ELEMENT.get(n,'Unknown')

PRODUCER={
'amplified':[r'become amplified',r'grants? amplified'],
'invisibility':[r'become invisible',r'makes? you invisible',r'grants? invisibility'],
'restoration':[r'grants? restoration',r'gain restoration'],
'radiant':[r'become radiant',r'grants? radiant'],
'overshield':[r'grants? (?:a )?(?:void )?overshield',r'gain (?:a )?(?:void )?overshield'],
'devour':[r'grants? devour',r'gain devour'],
'jolt':[r'jolts? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? jolt'],
'weaken':[r'weakens? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? weaken'],
'scorch':[r'scorches? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? scorch'],
'slow':[r'slows? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? slow'],
'freeze':[r'freezes? (?:nearby )?(?:targets|enemies|combatants)',r'freeze nearby'],
'suspend':[r'suspends? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? suspend'],
'sever':[r'severs? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? sever'],
'unravel':[r'unravels? (?:nearby )?(?:targets|enemies|combatants)',r'apply(?:ing)? unravel'],
'ionic trace':[r'creates? (?:an )?ionic trace',r'generate(?:s|d)? ionic traces?'],
'stasis shard':[r'creates? (?:a )?stasis shard',r'generate(?:s|d)? stasis shards?'],
'threadling':[r'creates? threadlings?',r'deploy(?:s|ing)? threadlings?']}
CONSUMER={
'amplified':[r'while amplified',r'while you are amplified'],
'invisibility':[r'while invisible',r'while you are invisible'],
'restoration':[r'restoration duration',r'extends? restoration'],
'radiant':[r'radiant duration',r'extends? radiant'],
'overshield':[r'while you have (?:a )?(?:void )?overshield',r'with (?:a )?(?:void )?overshield'],
'devour':[r'while devour',r'while devour is active'],
'jolt':[r'jolted (?:targets|enemies|combatants|opponents)',r'defeating (?:a )?jolted'],
'weaken':[r'weakened (?:targets|enemies|combatants)',r'defeating (?:a )?weakened'],
'scorch':[r'scorched (?:targets|enemies|combatants)',r'defeating (?:a )?scorched'],
'slow':[r'slowed (?:targets|enemies|combatants)'],
'freeze':[r'frozen (?:targets|enemies|combatants)',r'shatter(?:ing)? frozen'],
'suspend':[r'suspended (?:targets|enemies|combatants)',r'defeating (?:a )?suspended'],
'sever':[r'severed (?:targets|enemies|combatants)'],
'unravel':[r'unraveled (?:targets|enemies|combatants)'],
'ionic trace':[r'collecting (?:an )?ionic trace',r'ionic traces? grant'],
'stasis shard':[r'collecting (?:a )?stasis shard',r'stasis shards? grant'],
'threadling':[r'threadling damage',r'threadlings? deal']}
def effects(h,patterns):
    t=desc(h).lower();return [e for e,ps in patterns.items() if any(re.search(p,t) for p in ps)]

new=[];report=[]
for rec in extracted:
    idx,url,raw=rec['index'],rec['url'],rec['raw'];equipped=raw.get('equipped',[])
    candidates=[x for x in equipped if len((x.get('socketOverrides') or {}))>=5]
    subitem=max(candidates,key=lambda x:len(x.get('socketOverrides') or {}),default={})
    subhash=int(subitem['hash']) if subitem.get('hash') is not None else None
    subname=name(subhash) if subhash in defs else 'Unresolved subclass'
    elem=element_for(subname)
    socket_hashes=[int(v) for v in (subitem.get('socketOverrides') or {}).values()]
    components=[h for h in socket_hashes if ctype(h) in {'super','classAbility','movementAbility','melee','grenade','aspect','fragment'}]
    chains=[];seen=set()
    for a in components:
        for eff in effects(a,PRODUCER):
            for b in components:
                if a==b or eff not in effects(b,CONSUMER):continue
                sig=(a,eff,b)
                if sig in seen:continue
                seen.add(sig)
                chains.append({'from':{'hash':a,'name':name(a),'type':ctype(a)},'to':{'hash':b,'name':name(b),'type':ctype(b)},'output':eff,'input':eff,'evidence':f'Bungie DestinyInventoryItemDefinition {a} ({name(a)}): {desc(a)} | Bungie DestinyInventoryItemDefinition {b} ({name(b)}): {desc(b)}'})
    unresolved_here=sorted(h for h in rec['hashes'] if h not in defs)
    focus=f"{chains[0]['from']['name']} supplies {chains[0]['output']} for {chains[0]['to']['name']}." if chains else 'No directed causal loop curated from current Bungie manifest descriptions; field intentionally sparse.'
    weak=[]
    if unresolved_here:weak.append({'statement':f'{len(unresolved_here)} Destiny hashes did not resolve against the current Bungie inventory-item manifest; no identity or mechanic claims were made for them.','evidence':'Bungie current English mobile manifest resolution pass on 2026-08-13.'})
    f={'fixtureId':f'PF-COMM-{idx:02d}','dimId':str(raw.get('id') or url.split('/')[3]),'displayName':raw.get('name') or url.rsplit('/',1)[-1],'className':CLASS.get(raw.get('classType'),'Unknown'),'classType':raw.get('classType'),'subclassName':subname,'element':elem,'subclassHash':subhash,'itemCount':len(equipped),'modCount':len((raw.get('parameters') or {}).get('mods') or []),'artifactSeason':((raw.get('parameters') or {}).get('artifactUnlocks') or {}).get('seasonNumber'),'evidenceStatus':'Confirmed community DIM extraction' if subhash in defs else 'Community DIM extracted; subclass unresolved','source':'community-sourced','sourceUrl':url,'sourceDate':SOURCE_DATE,'evidenceNote':'Community DIM payload decoded from dim.gg; identities resolved only from Bungie current English manifest/cache.','buildFocus':focus,'synergyChains':chains,'weaponContribution':[],'activityProfile':{},'knownStrengths':[{'statement':f"Verified directed {c['output']} relationship from {c['from']['name']} to {c['to']['name']}.",'evidence':c['evidence']} for c in chains[:3]],'knownWeakLinks':weak,'mutationCases':[],'rawDim':raw,'allDestinyHashes':sorted(rec['hashes']),'dimPayloadStatus':'extracted'}
    new.append(f);report.append({'fixtureId':f['fixtureId'],'sourceUrl':url,'className':f['className'],'subclassName':subname,'element':elem,'curatedChains':len(chains),'unresolvedHashes':len(unresolved_here)})

assert hashlib.sha256(canonical(fixtures['fixtures']).encode()).hexdigest()==original_sha
fixtures['fixtures'].extend(new)
fixtures.update({'fixtureCount':52,'successfulExtractions':52,'failedExtractions':0,'failures':[],'communitySourceCount':29,'communitySourceDate':SOURCE_DATE})
assert len(fixtures['fixtures'])==52
assert [x['fixtureId'] for x in fixtures['fixtures'][:23]]==[f'PF-BETA-{i:02d}' for i in range(1,24)]
assert [x['fixtureId'] for x in fixtures['fixtures'][23:]]==[f'PF-COMM-{i:02d}' for i in range(1,30)]
assert all(x.get('source')=='community-sourced' and x.get('sourceUrl') in LINKS and x.get('sourceDate')==SOURCE_DATE for x in new)
FIX.write_text(json.dumps(fixtures,separators=(',',':')))
CACHE.write_text(json.dumps(cache,separators=(',',':')))
IDENT.write_text(json.dumps(identities,separators=(',',':')))
Path('/tmp/community-import-report.json').write_text(json.dumps({'original23Sha256':original_sha,'manifestResolved':len(defs),'manifestUnresolved':unresolved,'cacheAdditions':new_cache,'identityAdditions':new_id,'fixtures':report,'revenant':[r for r in report if r['className']=='Hunter' and (r['subclassName']=='Revenant' or r['element']=='Stasis')]}))
print('ORIGINAL_23_SHA='+original_sha)
print('COMMUNITY_REPORT='+json.dumps(report))
print('REVENANT_CHECK='+json.dumps([r for r in report if r['className']=='Hunter' and (r['subclassName']=='Revenant' or r['element']=='Stasis')]))
