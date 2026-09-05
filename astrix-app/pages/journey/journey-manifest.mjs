import {GuardianManifestService} from '../guardian-workspace-v2/guardian-manifest-service.mjs?v=20260905-journey-repair-1';

const BASE=new URL('../../data/journey-index/',import.meta.url);
const validHash=value=>value!==null&&value!==undefined&&value!==''&&Number.isInteger(Number(value))&&Number(value)>0&&Number(value)<=0xffffffff;
// Journey owns a small LRU of public definitions. Never load the equipment tables
// or a cached Character payload into this service. Profile progress stays separate.
export class JourneyManifestService{
  constructor({fetchImpl=globalThis.fetch?.bind(globalThis),fallback=new GuardianManifestService({selective:true,maxFallbackDefinitions:768,storage:{available:false}}),maxShards=8,maxBytes=6*1024*1024}={}){
    this.fetchImpl=fetchImpl;this.fallback=fallback;this.maxShards=maxShards;this.maxBytes=maxBytes;
    this.cache=new Map();this.pending=new Map();this.indexPromise=null;this.retainedBytes=0;
  }
  async index(){
    if(!this.indexPromise)this.indexPromise=(async()=>{
      const response=await this.fetchImpl(new URL('index.json?v=20260905-journey-repair-1',BASE));
      if(!response.ok)throw new Error('Journey catalogue unavailable');
      const index=await response.json();
      const version=await this.fallback.checkVersion();
      if(index.schemaVersion!==1||index.manifestVersion!==version)return null;
      return index;
    })().catch(error=>{this.indexPromise=null;throw error;});
    return this.indexPromise;
  }
  async shard(index,type,number){
    const key=`${type}:${number}`;
    if(this.cache.has(key)){const hit=this.cache.get(key);this.cache.delete(key);this.cache.set(key,hit);return hit.definitions;}
    if(this.pending.has(key))return this.pending.get(key);
    const task=(async()=>{
      const url=new URL(index.tables[type].shards[number],BASE);url.searchParams.set('manifest',index.manifestVersion);
      const response=await this.fetchImpl(url);
      if(!response.ok)throw new Error(`Journey definitions unavailable (${response.status})`);
      const payload=await response.json();
      if(payload.manifestVersion!==index.manifestVersion||!payload.definitions)throw new Error('Journey catalogue version changed');
      const bytes=index.tables[type].bytes[number];
      while(this.cache.size&&(this.cache.size>=this.maxShards||this.retainedBytes+bytes>this.maxBytes)){
        const oldest=this.cache.keys().next().value;this.retainedBytes-=this.cache.get(oldest).bytes;this.cache.delete(oldest);
      }
      if(bytes<=this.maxBytes){this.cache.set(key,{definitions:payload.definitions,bytes});this.retainedBytes+=bytes;}
      return payload.definitions;
    })();
    this.pending.set(key,task);
    try{return await task;}finally{this.pending.delete(key);}
  }
  async getMany(type,hashes){
    const unique=[...new Set([...hashes].filter(validHash).map(Number))];if(!unique.length)return {};
    const index=await this.index();const table=index?.tables?.[type];
    if(!table)return this.fallback.getMany(type,unique);
    const groups=new Map();for(const hash of unique){const n=table.lookup?.[hash]??hash%table.shards.length;if(!groups.has(n))groups.set(n,[]);groups.get(n).push(hash);}
    const rows={};
    // Resolve one shard at a time, retain only requested definitions in the result.
    for(const [number,wanted] of groups){const defs=await this.shard(index,type,number);for(const hash of wanted)if(defs[hash])rows[hash]=defs[hash];}
    return rows;
  }
  async getAsync(type,hash){return (await this.getMany(type,[hash]))[hash]||null;}
  status(){return {shards:this.cache.size,retainedBytes:this.retainedBytes,maxBytes:this.maxBytes};}
}
export const guardianManifest=new JourneyManifestService();
