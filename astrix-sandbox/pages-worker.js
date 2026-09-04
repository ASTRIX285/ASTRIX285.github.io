const STREAMED_FILES=new Map([
  ['/astrix-app/data/armor-information.json','application/json; charset=utf-8'],
]);
const RAW_BRANCH_ROOT='https://raw.githubusercontent.com/ASTRIX285/ASTRIX285.github.io/sandbox';

function sandboxResponse(response,contentType=''){
  const headers=new Headers(response.headers);
  headers.set('X-Robots-Tag','noindex, nofollow');
  headers.set('X-Content-Type-Options','nosniff');
  if(contentType)headers.set('Content-Type',contentType);
  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers,
  });
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const contentType=STREAMED_FILES.get(url.pathname);
    if(contentType&&(request.method==='GET'||request.method==='HEAD')){
      const upstream=await fetch(`${RAW_BRANCH_ROOT}${url.pathname}`,{
        method:request.method,
        headers:{Accept:contentType},
        cf:{cacheEverything:true,cacheTtl:300},
      });
      return sandboxResponse(upstream,contentType);
    }
    return sandboxResponse(await env.ASSETS.fetch(request));
  },
};
