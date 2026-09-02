const PROJECT='astrix-paradox-sandbox';
const PRODUCTION_BRANCH='sandbox';
const DOMAIN='sandbox.astrixparadox.com';
const ZONE_NAME='astrixparadox.com';
const PAGES_HOST=`${PROJECT}.pages.dev`;
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken=process.env.CLOUDFLARE_API_TOKEN;
const operation=process.argv[2];

if(!accountId||!apiToken)throw new Error('Cloudflare account credentials are unavailable.');

async function cloudflare(path,{method='GET',body,allowMissing=false}={}){
  const response=await fetch(`https://api.cloudflare.com/client/v4${path}`,{
    method,
    headers:{
      Authorization:`Bearer ${apiToken}`,
      'Content-Type':'application/json',
    },
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const payload=await response.json().catch(()=>({}));
  if(allowMissing&&response.status===404)return null;
  if(!response.ok||payload.success===false){
    const details=Array.isArray(payload.errors)?payload.errors.map(error=>error.message).join('; '):response.statusText;
    throw new Error(`Cloudflare API ${method} ${path}: ${details}`);
  }
  return payload.result;
}

async function ensureProject(){
  const path=`/accounts/${accountId}/pages/projects/${PROJECT}`;
  const existing=await cloudflare(path,{allowMissing:true});
  if(existing){
    if(existing.production_branch!==PRODUCTION_BRANCH){
      await cloudflare(path,{method:'PATCH',body:{production_branch:PRODUCTION_BRANCH}});
    }
    console.log(`SANDBOX_PAGES_PROJECT=READY ${PROJECT}`);
    return;
  }
  await cloudflare(`/accounts/${accountId}/pages/projects`,{
    method:'POST',
    body:{name:PROJECT,production_branch:PRODUCTION_BRANCH},
  });
  console.log(`SANDBOX_PAGES_PROJECT=CREATED ${PROJECT}`);
}

async function ensureDomain(){
  const domainsPath=`/accounts/${accountId}/pages/projects/${PROJECT}/domains`;
  const domains=await cloudflare(domainsPath);
  if(!domains.some(domain=>domain.name===DOMAIN)){
    await cloudflare(domainsPath,{method:'POST',body:{name:DOMAIN}});
  }

  const zones=await cloudflare(`/zones?name=${encodeURIComponent(ZONE_NAME)}&account.id=${encodeURIComponent(accountId)}`);
  const zone=zones.find(item=>item.name===ZONE_NAME);
  if(!zone)throw new Error(`Cloudflare zone not found: ${ZONE_NAME}`);
  const recordsPath=`/zones/${zone.id}/dns_records`;
  const records=await cloudflare(`${recordsPath}?type=CNAME&name=${encodeURIComponent(DOMAIN)}`);
  const record=records[0];
  const desired={type:'CNAME',name:DOMAIN,content:PAGES_HOST,proxied:true,ttl:1};
  if(!record){
    await cloudflare(recordsPath,{method:'POST',body:desired});
  }else if(record.content!==PAGES_HOST||record.proxied!==true){
    await cloudflare(`${recordsPath}/${record.id}`,{method:'PATCH',body:desired});
  }
  console.log(`SANDBOX_CUSTOM_DOMAIN=READY https://${DOMAIN}`);
}

if(operation==='ensure-project')await ensureProject();
else if(operation==='ensure-domain')await ensureDomain();
else throw new Error('Use ensure-project or ensure-domain.');
