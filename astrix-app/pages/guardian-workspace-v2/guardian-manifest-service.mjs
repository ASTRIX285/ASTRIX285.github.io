import {openGuardianDatabase,MANIFEST_STORE_NAME} from "./guardian-session-cache.mjs";
import {resolveArtifactTwoCatalog} from "./guardian-artifact-catalog.mjs";

const AUTH_ORIGIN=globalThis.ASTRIX_AUTH_ORIGIN||"https://auth.astrixparadox.com";
const BUNGIE_ORIGIN="https://www.bungie.net";
const CURRENT_KEY="manifest:current";
const COMPONENT_TYPES=Object.freeze([
  "DestinyInventoryItemDefinition",
  "DestinySandboxPerkDefinition",
  "DestinyArtifactDefinition",
  "DestinyPlugSetDefinition",
  "DestinyStatDefinition",
  "DestinySocketCategoryDefinition",
  "DestinyEquipableItemSetDefinition"
]);
const COMPONENT_SET=new Set(COMPONENT_TYPES);

const tableKey=(version,type)=>`manifest:${version}:${type}`;
const numericHash=value=>{
  const hash=Number(value);
  return Number.isInteger(hash)&&hash>=0?hash:null;
};
const definitionHash=(row,key)=>numericHash(row?.hash??row?.bungieHash??key);

function emitProgress(detail){
  if(typeof document==="undefined"||typeof CustomEvent==="undefined")return;
  document.dispatchEvent(new CustomEvent("astrix:manifest-progress",{detail}));
}

function requestValue(request){
  return new Promise(resolve=>{
    request.onsuccess=()=>resolve(request.result??null);
    request.onerror=()=>resolve(null);
  });
}

function transactionDone(transaction,db){
  return new Promise(resolve=>{
    transaction.oncomplete=()=>{db.close();resolve(true);};
    transaction.onerror=()=>{db.close();resolve(false);};
    transaction.onabort=()=>{db.close();resolve(false);};
  });
}

function createIndexedDbStorage(){
  const available=typeof indexedDB!=="undefined";
  const read=async key=>{
    const db=await openGuardianDatabase();
    if(!db||!db.objectStoreNames.contains(MANIFEST_STORE_NAME)){db?.close();return null;}
    const transaction=db.transaction(MANIFEST_STORE_NAME,"readonly");
    const done=transactionDone(transaction,db);
    const value=await requestValue(transaction.objectStore(MANIFEST_STORE_NAME).get(key));
    await done;
    return value;
  };
  const write=async record=>{
    const db=await openGuardianDatabase();
    if(!db||!db.objectStoreNames.contains(MANIFEST_STORE_NAME)){db?.close();return false;}
    const transaction=db.transaction(MANIFEST_STORE_NAME,"readwrite");
    transaction.objectStore(MANIFEST_STORE_NAME).put(record);
    return transactionDone(transaction,db);
  };
  const removeOtherVersions=async version=>{
    const db=await openGuardianDatabase();
    if(!db||!db.objectStoreNames.contains(MANIFEST_STORE_NAME)){db?.close();return false;}
    const transaction=db.transaction(MANIFEST_STORE_NAME,"readonly");
    const done=transactionDone(transaction,db);
    const keys=await requestValue(transaction.objectStore(MANIFEST_STORE_NAME).getAllKeys());
    await done;
    const stale=(Array.isArray(keys)?keys:[]).map(String).filter(key=>key.startsWith("manifest:")&&key!==CURRENT_KEY&&!key.startsWith(`manifest:${version}:`));
    if(!stale.length)return true;
    const writeDb=await openGuardianDatabase();
    if(!writeDb||!writeDb.objectStoreNames.contains(MANIFEST_STORE_NAME)){writeDb?.close();return false;}
    const writeTransaction=writeDb.transaction(MANIFEST_STORE_NAME,"readwrite");
    const store=writeTransaction.objectStore(MANIFEST_STORE_NAME);
    stale.forEach(key=>store.delete(key));
    return transactionDone(writeTransaction,writeDb);
  };
  return {
    available,
    readCurrent:()=>read(CURRENT_KEY),
    readTable:(version,type)=>read(tableKey(version,type)),
    writeTable:(version,type,definitions)=>write({key:tableKey(version,type),version,type,definitions,savedAt:Date.now()}),
    commitVersion:version=>write({key:CURRENT_KEY,version,types:[...COMPONENT_TYPES],savedAt:Date.now()}),
    removeOtherVersions
  };
}

async function responseJsonWithProgress(response,onProgress){
  if(!response.body?.getReader)return response.json();
  const length=Number(response.headers.get("Content-Length"))||0;
  const reader=response.body.getReader();
  let loaded=0;
  const stream=new ReadableStream({
    async pull(controller){
      const {done,value}=await reader.read();
      if(done){controller.close();return;}
      loaded+=value.byteLength;
      onProgress(length?loaded/length:null,loaded,length);
      controller.enqueue(value);
    },
    cancel(reason){return reader.cancel(reason);}
  });
  return new Response(stream,{headers:{"Content-Type":response.headers.get("Content-Type")||"application/json"}}).json();
}

function collectPayloadHashes(payload={}){
  const inventory=new Set();
  const stats=new Set();
  const profile=payload.profile||{};
  const addItem=item=>{
    const itemHash=numericHash(item?.itemHash);
    const styleHash=numericHash(item?.overrideStyleItemHash);
    if(itemHash!==null)inventory.add(itemHash);
    if(styleHash!==null)inventory.add(styleHash);
    for(const hash of item?.plugItemHashes||[]){const value=numericHash(hash);if(value!==null)inventory.add(value);}
  };
  for(const item of profile?.profileInventory?.data?.items||[])addItem(item);
  for(const row of Object.values(profile?.characterInventories?.data||{}))for(const item of row?.items||[])addItem(item);
  for(const row of Object.values(profile?.characterEquipment?.data||{}))for(const item of row?.items||[])addItem(item);
  for(const item of payload.selectedItems||[])addItem(item);
  for(const row of Object.values(profile?.itemComponents?.sockets?.data||{}))for(const socket of row?.sockets||[]){const hash=numericHash(socket?.plugHash);if(hash!==null)inventory.add(hash);}
  for(const row of Object.values(profile?.itemComponents?.reusablePlugs?.data||{}))for(const plugs of Object.values(row?.plugs||{}))for(const plug of plugs||[]){const hash=numericHash(plug?.plugItemHash??plug?.plugHash);if(hash!==null)inventory.add(hash);}
  for(const plugs of [profile?.profilePlugSets?.data?.plugs,...Object.values(profile?.characterPlugSets?.data||{}).map(row=>row?.plugs)])for(const rows of Object.values(plugs||{}))for(const plug of rows||[]){const hash=numericHash(plug?.plugItemHash??plug?.plugHash);if(hash!==null)inventory.add(hash);}
  for(const progression of Object.values(profile?.characterProgressions?.data||{}))for(const tier of progression?.seasonalArtifact?.tiers||[])for(const item of tier?.items||[]){const hash=numericHash(item?.itemHash);if(hash!==null)inventory.add(hash);}
  for(const character of Object.values(profile?.characters?.data||{}))for(const hash of Object.keys(character?.stats||{})){const value=numericHash(hash);if(value!==null)stats.add(value);}
  for(const row of Object.values(profile?.itemComponents?.stats?.data||{}))for(const hash of Object.keys(row?.stats||{})){const value=numericHash(hash);if(value!==null)stats.add(value);}
  return {inventory,stats};
}

class GuardianManifestService{
  constructor({fetchImpl=globalThis.fetch?.bind(globalThis),storage=createIndexedDbStorage(),authOrigin=AUTH_ORIGIN}={}){
    this.fetchImpl=fetchImpl;
    this.storage=storage;
    this.authOrigin=authOrigin;
    this.tables=new Map();
    this.cachedTypes=new Set();
    this.fallbackDefinitions=new Map();
    this.readyPromise=null;
    this.version="";
    this.mode="idle";
    this.versionMatched=false;
  }

  status(){return {mode:this.mode,version:this.version,versionMatched:this.versionMatched,types:[...this.tables.keys()]};}

  async fetchJson(url){
    if(!this.fetchImpl)throw new Error("Manifest network access is unavailable.");
    const response=await this.fetchImpl(url,{credentials:"include",headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`Manifest request failed (${response.status}).`);
    return response.json();
  }

  async initialise(){
    if(!this.storage?.available){
      this.mode="live-fallback";
      emitProgress({status:"fallback",percent:24,label:"IndexedDB unavailable · resolving definitions live"});
      return this;
    }
    try{
      emitProgress({status:"checking",percent:12,label:"Checking Bungie manifest version"});
      const metadata=await this.fetchJson(`${this.authOrigin}/bungie/manifest`);
      const paths=metadata?.jsonWorldComponentContentPaths?.en||metadata?.paths||{};
      const version=String(metadata?.version||"").trim();
      if(!version)throw new Error("Bungie manifest version is missing.");
      const downloadableTypes=COMPONENT_TYPES.filter(type=>paths[type]);
      if(downloadableTypes.length===0)throw new Error("Bungie manifest exposes no known component paths.");
      this.version=version;
      const current=await this.storage.readCurrent();
      if(current?.version===version){
        const records=await Promise.all(downloadableTypes.map(type=>this.storage.readTable(version,type)));
        if(records.every(record=>record?.definitions&&typeof record.definitions==="object")){
          downloadableTypes.forEach((type,index)=>{this.tables.set(type,records[index].definitions);this.cachedTypes.add(type);});
          this.mode="indexeddb";
          this.versionMatched=true;
          emitProgress({status:"ready",percent:58,label:`Bungie manifest ${version} loaded from IndexedDB`,version,versionMatched:true});
          return this;
        }
      }
      this.versionMatched=false;
      for(let index=0;index<downloadableTypes.length;index++){
        const type=downloadableTypes[index];
        const start=18+(index/downloadableTypes.length)*36;
        emitProgress({status:"downloading",percent:Math.round(start),label:`Downloading ${type}`,type,version});
        try{
          const url=new URL(`${this.authOrigin}/bungie/manifest/component`);
          url.searchParams.set("type",type);
          url.searchParams.set("version",version);
          const response=await this.fetchImpl(url,{credentials:"include",headers:{Accept:"application/json"}});
          if(!response.ok)throw new Error(`${type} download failed (${response.status}).`);
          const definitions=await responseJsonWithProgress(response,ratio=>{
            const percent=ratio===null?start:start+ratio*(36/downloadableTypes.length);
            emitProgress({status:"downloading",percent:Math.round(percent),label:`Downloading ${type}`,type,version});
          });
          if(!definitions||typeof definitions!=="object"||Array.isArray(definitions))throw new Error(`${type} did not return a definition table.`);
          if(!await this.storage.writeTable(version,type,definitions))throw new Error(`${type} could not be stored in IndexedDB.`);
          this.tables.set(type,definitions);
          this.cachedTypes.add(type);
          emitProgress({status:"indexing",percent:Math.round(start+36/downloadableTypes.length),label:`Indexed ${type}`,type,version});
        }catch(tableError){
          console.warn("manifest_table_skipped",{type,error:String(tableError?.message||tableError)});
          emitProgress({status:"downloading",percent:Math.round(start+36/downloadableTypes.length),label:`Skipped ${type} · resolving live`,type,version});
        }
      }
      if(this.cachedTypes.size===0)throw new Error("No manifest component tables could be cached.");
      if(!await this.storage.commitVersion(version))throw new Error("Manifest version marker could not be stored.");
      await this.storage.removeOtherVersions(version);
      this.mode="indexeddb";
      emitProgress({status:"ready",percent:58,label:`Bungie manifest ${version} indexed`,version,versionMatched:false});
      return this;
    }catch(error){
      this.mode="live-fallback";
      emitProgress({status:"fallback",percent:24,label:"Manifest cache unavailable · resolving definitions live",message:error?.message||String(error)});
      return this;
    }
  }

  ready(){
    if(!this.readyPromise)this.readyPromise=this.initialise();
    return this.readyPromise;
  }

  get(type,hash){
    const numeric=numericHash(hash);
    if(numeric===null)return null;
    return this.tables.get(type)?.[String(numeric)]||this.fallbackDefinitions.get(`${type}:${numeric}`)||null;
  }

  identity(hash,type="DestinyInventoryItemDefinition"){
    const numeric=numericHash(hash);
    const definition=this.get(type,numeric);
    const display=definition?.displayProperties||{};
    const sandboxDisplays=(definition?.perks||[]).map(perk=>this.get("DestinySandboxPerkDefinition",perk?.perkHash)?.displayProperties).filter(Boolean);
    const first=(key)=>display[key]||sandboxDisplays.find(row=>row?.[key])?.[key]||"";
    const resolved=Boolean(definition);
    return {
      hash:numeric,
      bungieHash:numeric,
      name:resolved?(first("name")||`Unnamed Destiny definition ${numeric}`):`Unresolved Destiny definition ${numeric}`,
      description:resolved?first("description"):"",
      icon:first("icon")?new URL(first("icon"),BUNGIE_ORIGIN).toString():"",
      definition,
      displayResolved:resolved,
      unresolved:!resolved,
      manifestVersion:this.version||null
    };
  }

  async getAsync(type,hash){
    const numeric=numericHash(hash);
    if(numeric===null)return null;
    const local=this.get(type,numeric);
    if(local||this.cachedTypes.has(type)&&this.mode==="indexeddb")return local;
    const key=`${type}:${numeric}`;
    if(this.fallbackDefinitions.has(key))return this.fallbackDefinitions.get(key);
    if(!this.fetchImpl)return null;
    const url=new URL(`${this.authOrigin}/bungie/manifest/definition`);
    url.searchParams.set("type",type);
    url.searchParams.set("hash",String(numeric));
    try{
      const payload=await this.fetchJson(url);
      const definition=payload?.definition||null;
      this.fallbackDefinitions.set(key,definition);
      return definition;
    }catch{
      this.fallbackDefinitions.set(key,null);
      return null;
    }
  }

  async getMany(type,hashes){
    const unique=[...new Set([...hashes].map(numericHash).filter(hash=>hash!==null))];
    const rows={};
    for(let offset=0;offset<unique.length;offset+=6){
      const batch=unique.slice(offset,offset+6);
      const definitions=await Promise.all(batch.map(hash=>this.getAsync(type,hash)));
      definitions.forEach((definition,index)=>{if(definition)rows[String(batch[index])]=definition;});
    }
    return rows;
  }

  async hydratePayload(payload={}){
    await this.ready();
    const indexedDb=this.mode==="indexeddb";
    const {inventory,stats}=collectPayloadHashes(payload);
    let definitions=indexedDb?await this.getMany("DestinyInventoryItemDefinition",inventory):{...(payload.definitions||{})};
    if(!indexedDb){
      const missing=[...inventory].filter(hash=>!definitions[String(hash)]);
      if(missing.length)definitions={...definitions,...await this.getMany("DestinyInventoryItemDefinition",missing)};
    }
    const socketCategories=new Set();
    const sandboxPerkHashes=new Set();
    const equipableSetHashes=new Set();
    const damageTypeHashes=new Set();
    const breakerTypeHashes=new Set();
    const expandedHashes=new Set();
    const inspectDefinition=definition=>{
      for(const entry of definition?.sockets?.socketEntries||[]){
        const initial=numericHash(entry?.singleInitialItemHash);if(initial!==null&&initial!==0)expandedHashes.add(initial);
        for(const plug of entry?.reusablePlugItems||[]){const hash=numericHash(plug?.plugItemHash);if(hash!==null)expandedHashes.add(hash);}
      }
      for(const category of definition?.sockets?.socketCategories||[]){const hash=numericHash(category?.socketCategoryHash);if(hash!==null)socketCategories.add(hash);}
      for(const perk of definition?.perks||[]){const hash=numericHash(perk?.perkHash);if(hash!==null)sandboxPerkHashes.add(hash);}
      const setHash=numericHash(definition?.equipableItemSetHash??definition?.equippingBlock?.equipableItemSetHash);if(setHash!==null)equipableSetHashes.add(setHash);
      const damageHash=numericHash(definition?.defaultDamageTypeHash);if(damageHash!==null)damageTypeHashes.add(damageHash);
      const breakerHash=numericHash(definition?.breakerTypeHash);if(breakerHash!==null)breakerTypeHashes.add(breakerHash);
    };
    Object.values(definitions).forEach(inspectDefinition);
    if(expandedHashes.size){
      const expanded=await this.getMany("DestinyInventoryItemDefinition",expandedHashes);
      definitions={...definitions,...expanded};
      Object.values(expanded).forEach(inspectDefinition);
    }
    for(const row of Object.values(payload?.profile?.itemComponents?.instances?.data||{})){
      const damageHash=numericHash(row?.damageTypeHash);if(damageHash!==null)damageTypeHashes.add(damageHash);
      const breakerHash=numericHash(row?.breakerTypeHash);if(breakerHash!==null)breakerTypeHashes.add(breakerHash);
    }
    const equipableItemSets=await this.getMany("DestinyEquipableItemSetDefinition",equipableSetHashes);
    for(const set of Object.values(equipableItemSets))for(const perk of set?.setPerks||[]){const hash=numericHash(perk?.sandboxPerkHash);if(hash!==null)sandboxPerkHashes.add(hash);}
    const [sandboxPerks,statDefinitions,socketCategoryDefinitions,damageDefinitions,breakerDefinitions]=await Promise.all([
      this.getMany("DestinySandboxPerkDefinition",sandboxPerkHashes),
      this.getMany("DestinyStatDefinition",stats),
      this.getMany("DestinySocketCategoryDefinition",socketCategories),
      this.getMany("DestinyDamageTypeDefinition",damageTypeHashes),
      this.getMany("DestinyBreakerTypeDefinition",breakerTypeHashes)
    ]);
    definitions=Object.fromEntries(Object.entries(definitions).map(([hash,definition])=>{
      const resolvedSandboxPerks=(definition?.perks||[]).map(perk=>sandboxPerks[String(perk?.perkHash)]).filter(Boolean);
      return [hash,resolvedSandboxPerks.length?{...definition,resolvedSandboxPerks}:definition];
    }));
    const artifactHash=numericHash(payload?.profile?.profileProgression?.data?.seasonalArtifact?.artifactHash);
    const artifactDefinition=payload.artifactDefinition||(artifactHash===null?null:await this.getAsync("DestinyArtifactDefinition",artifactHash));
    const artifactCatalog=resolveArtifactTwoCatalog({
      inventoryDefinitions:this.tables.get("DestinyInventoryItemDefinition")||definitions,
      plugSetDefinitions:this.tables.get("DestinyPlugSetDefinition")||{},
      manifestVersion:this.version||null
    });
    const requested=[...inventory,...expandedHashes];
    const unresolved=requested.filter(hash=>!definitions[String(hash)]);
    const artifactPerkHashes=[...new Set(Object.values(payload?.profile?.characterProgressions?.data||{}).flatMap(progression=>(progression?.seasonalArtifact?.tiers||[]).flatMap(tier=>(tier?.items||[]).map(item=>numericHash(item?.itemHash)).filter(hash=>hash!==null))))];
    payload.definitions=definitions;
    payload.sandboxPerks=sandboxPerks;
    payload.statDefinitions=statDefinitions;
    payload.socketCategoryDefinitions=socketCategoryDefinitions;
    payload.damageDefinitions=damageDefinitions;
    payload.breakerDefinitions=breakerDefinitions;
    payload.equipableItemSets=equipableItemSets;
    payload.artifactDefinition=artifactDefinition;
    payload.artifactCatalog=artifactCatalog;
    const resolutionSource=indexedDb?"indexeddb-manifest":"bungie-single-definition-endpoint";
    payload.definitionCoverage={requested:requested.length,resolved:requested.length-unresolved.length,unresolved,complete:unresolved.length===0,source:resolutionSource,version:this.version||null};
    const unresolvedArtifactPerks=artifactPerkHashes.filter(hash=>!definitions[String(hash)]);
    payload.artifactCoverage={hash:artifactHash,definitionResolved:Boolean(artifactDefinition),perkHashes:artifactPerkHashes,unresolvedPerkHashes:unresolvedArtifactPerks,complete:(artifactHash===null||Boolean(artifactDefinition))&&unresolvedArtifactPerks.length===0,source:resolutionSource,version:this.version||null};
    payload.artifactCatalogCoverage={model:'artifact-2-socket-buckets',artifactCount:artifactCatalog.length,complete:artifactCatalog.length>0,source:resolutionSource,version:this.version||null};
    payload.manifestResolution={mode:indexedDb?"indexeddb":"live-fallback",version:this.version||null,versionMatched:indexedDb?this.versionMatched:false,source:indexedDb?"Destiny manifest component tables":"bungie-single-definition-endpoint"};
    return payload;
  }
}

const guardianManifest=new GuardianManifestService();

export {COMPONENT_TYPES,GuardianManifestService,createIndexedDbStorage,collectPayloadHashes,guardianManifest};
