// Public game definitions only. This Worker has no OAuth or account bindings.
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method!=='GET')return new Response(null,{status:405});
    const indexResponse=await env.ASSETS.fetch(new Request('https://assets/index.json'));
    if(!indexResponse.ok)return new Response(null,{status:503});
    const index=await indexResponse.json();
    if(url.pathname==='/status')return Response.json(index);
    if(url.pathname!=='/definitions')return new Response(null,{status:404});
    if(url.searchParams.get('version')!==index.manifestVersion)return Response.json({error:'manifest_version_changed'},{status:409});
    const type=url.searchParams.get('type'),table=index.tables[type];
    const hashes=[...new Set((url.searchParams.get('hashes')||'').split(','))];
    if(!table||hashes.length>48||hashes.some(h=>!/^\d+$/.test(h)||Number(h)<=0||Number(h)>0xffffffff))return new Response(null,{status:400});
    const groups=new Map();
    for(const hash of hashes){const shard=Number(hash)%table.shards;if(!groups.has(shard))groups.set(shard,[]);groups.get(shard).push(hash);}
    const definitions={};
    // Each shard is <= 2 MiB. Never parse a whole Bungie definition table here.
    for(const [shard,wanted] of groups){
      const response=await env.ASSETS.fetch(new Request(`https://assets/${type}/${shard}.json`));
      if(!response.ok)return new Response(null,{status:503});
      const rows=await response.json();
      for(const hash of wanted)if(rows[hash])definitions[hash]=rows[hash];
    }
    return Response.json({manifestVersion:index.manifestVersion,type,definitions,unresolved:hashes.filter(h=>!definitions[h])});
  }
};
