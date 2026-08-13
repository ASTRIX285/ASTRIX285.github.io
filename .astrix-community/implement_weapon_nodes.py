import json,urllib.request,sqlite3,zipfile,io,gzip,re
from pathlib import Path
ROOT=Path('.')
LOADER=ROOT/'astrix-app/pages/guardian-workspace-v2/guardian-fixture-loader.mjs'
ENGINE=ROOT/'astrix-app/pages/guardian-workspace-v2/guardian-paradox-engine.mjs'
CACHE=ROOT/'astrix-app/data/paradox-forge/beta/beta-bungie-manifest-cache.json'
TEST=ROOT/'astrix-app/tools/test-weapon-roll-nodes.mjs'

# 1) Add official Bungie perk plug definitions needed for deterministic test coverage.
TARGETS=[2173046394,3523296417,4293542123,2610012052,776531651,2048641572,124408337,2978966579]
UA={'User-Agent':'Mozilla/5.0'}
def get(url):
 req=urllib.request.Request(url,headers=UA)
 with urllib.request.urlopen(req,timeout=90) as r:return r.read()
meta=json.loads(get('https://www.bungie.net/Platform/Destiny2/Manifest/').decode())['Response']; mp=meta['mobileWorldContentPaths']['en']; payload=get('https://www.bungie.net'+mp); db=Path('/tmp/world.content')
if payload[:2]==b'PK':
 with zipfile.ZipFile(io.BytesIO(payload)) as z: db.write_bytes(z.read([n for n in z.namelist() if not n.endswith('/')][0]))
elif payload[:2]==b'\x1f\x8b': db.write_bytes(gzip.decompress(payload))
else: db.write_bytes(payload)
con=sqlite3.connect(str(db)); cur=con.cursor(); cache=json.loads(CACHE.read_text()); inv=cache.setdefault('inventoryItems',{})
def signed(h):return h if h<2**31 else h-2**32
added=[]
for h in TARGETS:
 row=cur.execute('select json from DestinyInventoryItemDefinition where id=?',(signed(h),)).fetchone()
 if not row:raise RuntimeError(f'Live Bungie manifest did not resolve perk {h}')
 d=json.loads(row[0]); dp=d.get('displayProperties') or {}
 inv[str(h)]={'display':dp,'itemType':d.get('itemType'),'itemSubType':d.get('itemSubType'),'itemTypeDisplayName':d.get('itemTypeDisplayName',''),'classType':d.get('classType'),'itemCategoryHashes':d.get('itemCategoryHashes') or [],'traitIds':d.get('traitIds') or [],'equippingBlock':d.get('equippingBlock') or {},'intrinsicPlugHashes':[]}
 added.append({'hash':h,'name':dp.get('name'),'description':dp.get('description')})
con.close(); CACHE.write_text(json.dumps(cache,separators=(',',':')))

# 2) Loader: preserve authored rollPerks and resolve runtime perk identities.
l=LOADER.read_text()
old='function normalizeFixture(fixture){\n  const equipped=(fixture.rawDim?.equipped??[]).map(item=>({...resolve(item.hash),socketOverrides:item.socketOverrides??null}));const subclass=subclassParts(fixture);'
new='function normalizeFixture(fixture){\n  const equipped=(fixture.rawDim?.equipped??[]).map(item=>{const rollPerks=(item.rollPerks??[]).map(row=>({perkHash:Number(row.perkHash),socket:row.socket}));return {...resolve(item.hash),socketOverrides:item.socketOverrides??null,rollPerks,resolvedPerks:rollPerks.map(row=>({...row,definition:resolve(row.perkHash)})),fixtureSourceUrl:fixture.sourceUrl??null};});const subclass=subclassParts(fixture);'
if old not in l:raise RuntimeError('Loader normalizeFixture anchor not found')
l=l.replace(old,new)
oldret='return {source:"paradox-beta-fixture",fixtureId:fixture.fixtureId,dimId:fixture.dimId,characterId:fixture.fixtureId,displayName:fixture.displayName,'
newret='return {source:"paradox-beta-fixture",fixtureId:fixture.fixtureId,dimId:fixture.dimId,sourceUrl:fixture.sourceUrl??null,characterId:fixture.fixtureId,displayName:fixture.displayName,'
if oldret not in l:raise RuntimeError('Loader return anchor not found')
l=l.replace(oldret,newret)
LOADER.write_text(l)

# 3) Engine: add roll metadata, derive perk effects, preserve no-roll behavior.
e=ENGINE.read_text()
old='    directionEvidence: item?.directionEvidence ?? null,\n    unresolved: unresolved(item),\n    raw: item\n'
new='    directionEvidence: item?.directionEvidence ?? null,\n    rollPerks: Array.isArray(item?.rollPerks) ? item.rollPerks : [],\n    resolvedPerks: Array.isArray(item?.resolvedPerks) ? item.resolvedPerks : [],\n    fixtureSourceUrl: item?.fixtureSourceUrl ?? null,\n    unresolved: unresolved(item),\n    raw: item\n'
if old not in e:raise RuntimeError('normalizeItem anchor missing')
e=e.replace(old,new)

anchor='function buildEvidenceNodes(build) {\n  return equippedComponents(build).map(item => ({\n    ...item,\n    effects: descriptionEffects(item),\n    directionEffects: directionalTextEffects(item),\n    traitEffects: traitIdEffects(item)\n  }));\n}\n'
addition=r'''const WEAPON_ROLE_TYPES = new Set(['verb-applicator','energy-engine','pickup/entity-generator','final-blow-trigger','verb-payoff','counter-role']);
const WEAPON_VERB_TOKENS = new Set(['blind','devour','freeze','ignite','jolt','radiant','restoration','scorch','sever','slow','suspend','suppression','unravel','volatile','weaken']);
const WEAPON_ENTITY_TOKENS = new Set(['ionic-trace','stasis-crystal','stasis-shard','tangle','threadling','orb-of-power']);
const WEAPON_ENERGY_TOKENS = new Set(['grenade-energy','melee-energy','class-ability-energy','super-energy']);

function weaponTriggerEffects(description) {
  const text=lower(description);const outputs=[];const inputs=[];const mentions=[];
  const addOut=x=>{outputs.push(x);mentions.push(x)};const addIn=x=>{inputs.push(x);mentions.push(x)};
  if(/\b(?:kills|final blows?) with this weapon\b.{0,80}\bgrenade energy\b|\b(?:kills|final blows?)\b.{0,80}\bgrenade energy\b/i.test(text))addOut('grenade-energy');
  if(/\bionic traces?\b/i.test(text)&&/\b(?:create|creates|generate|generates|spawn|spawns)\b/i.test(text))addOut('ionic-trace');
  if(/\bprecision final blows?\b/i.test(text)){addIn('precision-final-blow');if(/\bstasis crystal\b/i.test(text))addOut('stasis-crystal');}
  else if(/\brapid(?:ly)?\b.{0,28}\b(?:kills?|final blows?)\b|\b(?:rapid kills?|rapid final blows?)\b/i.test(text))addIn('rapid-final-blow');
  else if(/\b(?:kills?|final blows?|defeating a target|defeating targets)\b/i.test(text))addIn('weapon-final-blow');
  if(/\breload(?:ing)?\b/i.test(text))addIn('reload');
  if(/\b(?:stow|stowed|ready|readied)\b/i.test(text))addIn('stow-ready');
  if(/\b(?:spread|spreads)\b.{0,30}\bscorch\b/i.test(text))addOut('scorch');
  if(/\b(?:slow|slows|slowing)\b.{0,36}\b(?:target|targets|enemy|enemies|combatants)\b/i.test(text))addOut('slow');
  if(/\b(?:makes?|making)\b.{0,30}\bvolatile\b|\bvolatile rounds\b/i.test(text))addOut('volatile');
  if(/\bgrenade or melee kills?\b.{0,64}\bsame damage type\b/i.test(text))addIn('matching-element-ability-final-blow');
  if(/\bvoid-debuffed target\b/i.test(text))addIn('void-debuffed-target');
  return {outputs:uniq(outputs),inputs:uniq(inputs),mentions:uniq(mentions)};
}

function weaponRollEffects(item){
  if(item?.type!=='weapon'||!item.resolvedPerks?.length)return {hasRollEvidence:false,outputs:[],inputs:[],mentions:[],evidence:[]};
  const outputs=[],inputs=[],mentions=[],evidence=[];
  for(const row of item.resolvedPerks){
    const perk=normalizeItem(row?.definition,'weaponPerk');
    if(!perk||perk.unresolved||!perk.description)continue;
    const base=descriptionEffects(perk);const trigger=weaponTriggerEffects(perk.description);const traits=traitIdEffects(perk);
    outputs.push(...base.outputs,...trigger.outputs,...traits.buffOutputs);inputs.push(...base.inputs,...trigger.inputs);mentions.push(...base.mentions,...trigger.mentions,...traits.mentions);
    evidence.push({perkHash:Number(row.perkHash),socket:row.socket,manifestSnippet:perk.description,traitIds:perk.traitIds,sourceUrl:item.fixtureSourceUrl??null});
  }
  return {hasRollEvidence:evidence.length>0,outputs:uniq(outputs),inputs:uniq(inputs),mentions:uniq(mentions),evidence};
}

function buildEvidenceNodes(build) {
  return equippedComponents(build).map(item => {
    const base=descriptionEffects(item);const weaponEffects=weaponRollEffects(item);
    return {...item,effects:weaponEffects.hasRollEvidence?{outputs:uniq([...base.outputs,...weaponEffects.outputs]),inputs:uniq([...base.inputs,...weaponEffects.inputs]),mentions:uniq([...base.mentions,...weaponEffects.mentions])}:base,directionEffects:directionalTextEffects(item),traitEffects:traitIdEffects(item),weaponEffects};
  });
}
'''
if anchor not in e:raise RuntimeError('buildEvidenceNodes anchor missing')
e=e.replace(anchor,addition)

# Replace makeLoop evidence/source construction only, retaining matching algorithm.
old="""        links.push({\n          from: { hash: producer.hash, name: producer.name, type: producer.type },\n          output: effect,\n          to: { hash: consumer.hash, name: consumer.name, type: consumer.type },\n          input: effect,\n          chain: `${producer.name} -> ${effect} -> ${consumer.name}`,\n          evidence: { producer: producer.description, consumer: consumer.description, source: 'bungie-manifest-description' }\n        });"""
new="""        const producerPerkEvidence=producer.weaponEffects?.outputs?.includes(effect)?producer.weaponEffects.evidence:[];\n        const consumerPerkEvidence=consumer.weaponEffects?.inputs?.includes(effect)?consumer.weaponEffects.evidence:[];\n        const weaponBacked=producerPerkEvidence.length||consumerPerkEvidence.length;\n        links.push({\n          from: { hash: producer.hash, name: producer.name, type: producer.type },\n          output: effect,\n          to: { hash: consumer.hash, name: consumer.name, type: consumer.type },\n          input: effect,\n          chain: `${producer.name} -> ${effect} -> ${consumer.name}`,\n          source: weaponBacked?'runtime-weapon-perk-parsing':undefined,\n          evidence: { producer: producerPerkEvidence.length?producerPerkEvidence:producer.description, consumer: consumerPerkEvidence.length?consumerPerkEvidence:consumer.description, source: weaponBacked?'bungie-manifest-weapon-perk':'bungie-manifest-description' }\n        });"""
if old not in e:raise RuntimeError('makeLoop link anchor missing')
e=e.replace(old,new)

old="function weaponContribution(nodes, loop) {\n  return nodes.filter(n => n.type === 'weapon').map(weapon => {\n    const outgoing = loop.filter(x => x.from.hash === weapon.hash);\n    const incoming = loop.filter(x => x.to.hash === weapon.hash);\n    const roles = uniq([...outgoing.map(x => `supplies ${x.output} to ${x.to.name}`), ...incoming.map(x => `uses ${x.input} from ${x.from.name}`)]);\n    const verified = !weapon.unresolved && roles.length > 0;\n    return {\n      hash: weapon.hash, name: weapon.name,\n      status: weapon.unresolved ? 'unresolved' : verified ? 'verified-loop-contributor' : 'insufficient-evidence',\n      roles, evidence: verified ? weapon.description : null,\n      note: verified ? null : weapon.unresolved ? 'Weapon identity is unresolved; no loop claim made.' : 'No explicit causal contribution can be proven from available fixture/manifest evidence; no loop claim made.'\n    };\n  });\n}\n"
new=r'''function weaponRoleType(link,weapon){
  const outgoing=Number(link?.from?.hash)===Number(weapon.hash);const token=canonEffect(outgoing?link.output:link.input);
  if(WEAPON_ENERGY_TOKENS.has(token))return 'energy-engine';
  if(WEAPON_ENTITY_TOKENS.has(token))return 'pickup/entity-generator';
  if(outgoing&&WEAPON_VERB_TOKENS.has(token))return 'verb-applicator';
  if(!outgoing&&(token.includes('final-blow')||token==='reload'||token==='stow-ready'))return 'final-blow-trigger';
  if(!outgoing&&WEAPON_VERB_TOKENS.has(token))return 'verb-payoff';
  return 'final-blow-trigger';
}

function weaponContribution(nodes, loop) {
  return nodes.filter(n => n.type === 'weapon').map(weapon => {
    const outgoing = loop.filter(x => x.from.hash === weapon.hash);
    const incoming = loop.filter(x => x.to.hash === weapon.hash);
    const roles = uniq([...outgoing.map(x => `supplies ${x.output} to ${x.to.name}`), ...incoming.map(x => `uses ${x.input} from ${x.from.name}`)]);
    const verified = !weapon.unresolved && roles.length > 0;
    const base={hash:weapon.hash,name:weapon.name,status:weapon.unresolved?'unresolved':verified?'verified-loop-contributor':'insufficient-evidence',roles,evidence:verified?weapon.description:null,note:verified?null:weapon.unresolved?'Weapon identity is unresolved; no loop claim made.':'No explicit causal contribution can be proven from available fixture/manifest evidence; no loop claim made.'};
    if(!weapon.weaponEffects?.hasRollEvidence)return base;
    const contributionLinks=[...outgoing,...incoming].filter(link=>link.source==='runtime-weapon-perk-parsing'||sourceParts(link).some(x=>x.source==='runtime-weapon-perk-parsing'));
    const contributions=contributionLinks.map(link=>{const roleType=weaponRoleType(link,weapon);if(!WEAPON_ROLE_TYPES.has(roleType))throw new Error(`Unknown weapon role type: ${roleType}`);return {roleType,chain:link.chain,output:link.output,input:link.input,evidence:link.evidence};});
    return {...base,status:contributions.length?'verified-loop-contributor':'insufficient-evidence',emits:weapon.weaponEffects.outputs,consumes:weapon.weaponEffects.inputs,evidence:weapon.weaponEffects.evidence,contributions,note:contributions.length?null:'Roll perks resolved, but no equipped citable consumer/producer completed a directed edge.'};
  });
}
'''
if old not in e:raise RuntimeError('weaponContribution anchor missing')
e=e.replace(old,new)

old="function runtimeLoopWithSource(loop) {\n  return loop.map(link => ({ ...link, source: 'runtime-description-parsing', evidenceSources: [{ source: 'runtime-description-parsing', evidence: link.evidence }] }));\n}\n"
new="function runtimeLoopWithSource(loop) {\n  return loop.map(link => {const source=link.source??'runtime-description-parsing';return {...link,source,evidenceSources:[{source,evidence:link.evidence}]};});\n}\n"
if old not in e:raise RuntimeError('runtimeLoopWithSource anchor missing')
e=e.replace(old,new)
ENGINE.write_text(e)

# 4) Self-test: baseline PF-BETA snapshot, synthetic real Voltshot roll, mutation staleness.
TEST.write_text(r'''import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=process.cwd(),dataRoot=path.join(root,'astrix-app/data/paradox-forge/beta'),pageRoot=path.join(root,'astrix-app/pages/guardian-workspace-v2');
const files=['ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json','beta-component-identities.json','beta-bungie-manifest-cache.json','beta-bungie-manifest-cache-trait-direction-extension.json'];const routes=new Map(files.map(n=>[n,path.join(dataRoot,n)]));
globalThis.document={readyState:'loading',addEventListener(){},dispatchEvent(){return true},getElementById(){return null},querySelector(){return null},createElement(){return {setAttribute(){},appendChild(){},style:{},addEventListener(){}}}};globalThis.CustomEvent=class{constructor(t,i={}){this.type=t;this.detail=i.detail}};
globalThis.fetch=async input=>{const s=String(input),n=[...routes.keys()].find(k=>s.endsWith(k));if(!n)return{ok:false,status:404,json:async()=>({})};const txt=await fs.readFile(routes.get(n),'utf8');return{ok:true,status:200,json:async()=>JSON.parse(txt)}};
const loader=await import(pathToFileURL(path.join(pageRoot,'guardian-fixture-loader.mjs')).href+'?weaponroll=1');const engine=await import(pathToFileURL(path.join(pageRoot,'guardian-paradox-engine.mjs')).href+'?weaponroll=1');const raw=JSON.parse(await fs.readFile(routes.get('ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json'),'utf8'));const cache=JSON.parse(await fs.readFile(routes.get('beta-bungie-manifest-cache.json'),'utf8'));
const baseline=[];for(const f of raw.fixtures.filter(x=>x.fixtureId.startsWith('PF-BETA-'))){const b=await loader.loadBetaFixture(f.fixtureId);const a=engine.analyzeGuardianBuild(b);baseline.push({fixtureId:f.fixtureId,confidence:a.confidence.level,loops:a.buildLoop.map(x=>[x.from.hash,x.output,x.to.hash,x.source]).sort(),weapons:a.weaponContribution.map(x=>({hash:x.hash,status:x.status,roles:x.roles}))});}
console.log('PF_BETA_BASELINE='+JSON.stringify(baseline));
const volt=cache.inventoryItems['2173046394'];if(!volt)throw new Error('Voltshot 2173046394 missing from manifest cache');
const consumer={hash:4194622036,bungieHash:4194622036,name:'Flow State',componentType:'aspect',description:'Defeating a jolted target makes you amplified.',traitIds:['keywords.debuffs.arc.jolt']};
const weapon={hash:900000001,bungieHash:900000001,name:'Synthetic owned Arc weapon',sourceKind:'weapon',description:'',rollPerks:[{perkHash:2173046394,socket:'trait2'}],resolvedPerks:[{perkHash:2173046394,socket:'trait2',definition:{hash:2173046394,bungieHash:2173046394,name:volt.display.name,description:volt.display.description,traitIds:volt.traitIds??[],sourceKind:'gameComponent'}}]};
const before={source:'paradox-beta-fixture',fixtureId:'WEAPON-ROLL-SELFTEST',aspects:[consumer],weapons:[weapon],synergyChains:[]};const after={...before,weapons:[{hash:900000002,bungieHash:900000002,name:'Swapped weapon without roll evidence',sourceKind:'weapon',description:''}]};
const ba=engine.analyzeGuardianBuild(before),aa=engine.analyzeGuardianBuild(after);const link=ba.buildLoop.find(x=>x.from.hash===900000001&&x.output==='jolt'&&x.to.hash===4194622036);if(!link)throw new Error('Expected Voltshot -> jolt -> Flow State link');if(link.source!=='runtime-weapon-perk-parsing')throw new Error('Weapon link missing runtime-weapon-perk-parsing source');if(aa.buildLoop.some(x=>x.from.hash===900000001||x.to.hash===900000001))throw new Error('Stale weapon link survived swap');const wc=ba.weaponContribution.find(x=>x.hash===900000001);if(!wc||wc.status!=='verified-loop-contributor'||!wc.contributions?.some(x=>x.roleType==='verb-applicator'))throw new Error('Expected verb-applicator weapon contribution');
console.log('WEAPON_ROLE='+JSON.stringify({fixtureId:before.fixtureId,weapon:weapon.name,roleType:wc.contributions[0].roleType,emit:'jolt',consumer:'Flow State',evidence:wc.evidence}));console.log('MUTATION='+JSON.stringify({before:ba.buildLoop.map(x=>x.chain),after:aa.buildLoop.map(x=>x.chain),weaponLinksVanished:!aa.buildLoop.some(x=>x.from.hash===900000001||x.to.hash===900000001)}));
''')
print('LIVE_PERKS_ADDED='+json.dumps(added,separators=(',',':')))
print('FILES_PATCHED='+json.dumps([str(LOADER),str(ENGINE),str(CACHE),str(TEST)]))
