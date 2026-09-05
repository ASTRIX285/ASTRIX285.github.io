#!/usr/bin/env python3
"""Generate bounded Journey definition shards from an official Bungie snapshot."""
import argparse,json,sqlite3,os,urllib.request
from pathlib import Path
FIELDS={
 'DestinyPresentationNodeDefinition':('displayProperties','originalIcon','rootViewIcon','children','parentNodeHashes','completionRecordHash','objectiveHash'),
 'DestinyRecordDefinition':('displayProperties','originalIcon','rootViewIcon','objectiveHashes','stateInfo','titleInfo','recordTypeName','completionInfo','parentNodeHashes','presentationInfo'),
 'DestinyObjectiveDefinition':('displayProperties','progressDescription','completionValue','destinationHash','activityHash'),
 'DestinyActivityDefinition':('displayProperties','destinationHash','activityModeTypes','activityTypeHash'),
 'DestinyDestinationDefinition':('displayProperties','bubbles','placeHash'),
 'DestinyMetricDefinition':('displayProperties','trackingObjectiveHash'),
}
def build(database,metadata,out):
 version=metadata.get('Response',metadata)['version']; out.mkdir(parents=True,exist_ok=True)
 nodes={str(row['hash']):row for (raw,) in database.execute('SELECT json FROM DestinyPresentationNodeDefinition') for row in [json.loads(raw)]}
 anchors={e['presentationNodeHash'] for root in [1866538467,4227847809,2744330515,3442838224] for e in nodes.get(str(root),{}).get('children',{}).get('presentationNodes',[])}
 def branch_shard(row):
  pending=list(row.get('parentNodeHashes',[]));seen=set()
  while pending:
   h=pending.pop(0)
   if h in anchors:return h%16
   if h in seen:continue
   seen.add(h);pending.extend(nodes.get(str(h),{}).get('parentNodeHashes',[]))
  return row['hash']%16
 objective_shards={}
 for (raw,) in database.execute('SELECT json FROM DestinyRecordDefinition ORDER BY id'):
  row=json.loads(raw)
  for h in row.get('objectiveHashes',[]):objective_shards.setdefault(h,branch_shard(row))
 index={'schemaVersion':1,'manifestVersion':version,'source':'Bungie English world manifest','tables':{},'endgameByDestination':{}}
 for table,fields in FIELDS.items():
  count=1 if table in ('DestinyPresentationNodeDefinition','DestinyMetricDefinition','DestinyDestinationDefinition') else 16
  shards=[{} for _ in range(count)]; raw_bytes=0; lookup={}
  for (raw,) in database.execute('SELECT json FROM '+table+' ORDER BY id'):
   row=json.loads(raw);raw_bytes+=len(raw.encode());h=row['hash']
   compact={'hash':h,**{k:row[k] for k in fields if k in row}}
   if table=='DestinyActivityDefinition' and not row.get('redacted') and {4,82}.intersection(row.get('activityModeTypes',[])):
    index['endgameByDestination'].setdefault(str(row.get('destinationHash')),[]).append(h)
   number=branch_shard(row) if table=='DestinyRecordDefinition' else objective_shards.get(h,h%count) if table=='DestinyObjectiveDefinition' else h%count
   shards[number][str(h)]=compact
   if table in ('DestinyRecordDefinition','DestinyObjectiveDefinition'):lookup[str(h)]=number
  paths=[];sizes=[]
  for number,definitions in enumerate(shards):
   name=f'{table}-{number}.json'; data=json.dumps({'manifestVersion':version,'definitions':definitions},ensure_ascii=False,separators=(',',':')).encode()
   (out/name).write_bytes(data);paths.append(name);sizes.append(len(data))
  index['tables'][table]={'shards':paths,'bytes':sizes,'count':sum(map(len,shards)),'sourceBytes':raw_bytes,'lookup':lookup}
 (out/'index.json').write_text(json.dumps(index,separators=(',',':')))
 print(json.dumps({'tables':{k:{'definitions':v['count'],'bytes':sum(v['bytes']),'largestShard':max(v['bytes'])} for k,v in index['tables'].items()}}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--sqlite');p.add_argument('--metadata');p.add_argument('--download',action='store_true');p.add_argument('--output',default=str(Path(__file__).resolve().parents[1]/'data/journey-index'));a=p.parse_args()
 if a.download:
  def fetch(url):
   headers={'User-Agent':'ASTRIX-PARADOX/Journey'}
   if os.environ.get('BUNGIE_API_KEY'):headers['X-API-Key']=os.environ['BUNGIE_API_KEY']
   with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=90) as response:return json.load(response)
  metadata=fetch('https://www.bungie.net/Platform/Destiny2/Manifest/')
  old=Path(a.output)/'index.json'
  if old.exists() and json.loads(old.read_text()).get('manifestVersion')==metadata['Response']['version']:print('JOURNEY_INDEX_CURRENT');raise SystemExit(0)
  db=sqlite3.connect(':memory:')
  for table in FIELDS:
   rows=fetch('https://www.bungie.net'+metadata['Response']['jsonWorldComponentContentPaths']['en'][table])
   db.execute('CREATE TABLE '+table+' (id INTEGER PRIMARY KEY,json TEXT)')
   db.executemany('INSERT INTO '+table+' VALUES (?,?)',[(int(h),json.dumps(row)) for h,row in rows.items()])
  build(db,metadata,Path(a.output));db.close()
 else:
  if not a.sqlite or not a.metadata:p.error('Provide --download or --sqlite and --metadata')
  with sqlite3.connect(a.sqlite) as db:build(db,json.loads(Path(a.metadata).read_text()),Path(a.output))
