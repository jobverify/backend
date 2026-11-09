// GET-only public portal transport. Nothing in this module runs on import.
export const BASE='https://jobs.globalpayments.com/jobs';
const ORIGIN='https://jobs.globalpayments.com';
export function validateURL(value,{method='GET',advertisedAssets=[]}={}){
 if(method!=='GET'||typeof value!=='string')throw Error('Global Payments: unknown request contract');
 const u=new URL(value);if(u.origin!==ORIGIN||u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.href!==value)throw Error('Global Payments: unsafe public URL');
 const portal=['/','/jobs'].includes(u.pathname)||/^\/jobs\/[A-Za-z0-9_-]+$/.test(u.pathname)&&!/^\/jobs\/(?:apply|application|login|auth)$/i.test(u.pathname);
 const asset=/^\/_next\/static\/[A-Za-z0-9_./-]+\.js$/.test(u.pathname)&&!u.pathname.split('/').includes('..')&&advertisedAssets.includes(value);
 if(!portal&&!asset)throw Error('Global Payments: unadvertised endpoint or application');return u.href;
}
export function createNativeTransport({fetchImpl=globalThis.fetch,maxBytes=16*1024*1024,timeoutMs=30000,signal}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid transport bounds');
 return async(value,{advertisedAssets=[]}={})=>{
  let url=validateURL(value,{advertisedAssets});const startedAt=new Date().toISOString(),controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  const timer=setTimeout(()=>controller.abort(new Error('Global Payments request timeout')),timeoutMs);
  try{for(let hop=0;hop<=3;hop++){
   combined.throwIfAborted();const response=await fetchImpl(url,{method:'GET',headers:{accept:'text/html, application/javascript;q=0.9'},redirect:'manual',credentials:'omit',signal:combined});
   if(response.url&&response.url!==url)throw Error('Unexpected implicit redirect');
   if([301,302,303,307,308].includes(response.status)){
    const location=response.headers.get('location');await response.body?.cancel();if(!location||hop===3)throw Error('Missing or excessive redirect');
    const next=validateURL(new URL(location,url).href,{advertisedAssets});
    // Same exact resource only: redirects cannot silently replace an inventory,
    // native identity or advertised asset with a different public contract.
    if(next!==value)throw Error('Unexpected public resource redirect');url=next;continue;
   }
   const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes)){await response.body?.cancel();throw Error('Global Payments byte limit');}
   const chunks=[];let bytes=0;const reader=response.body?.getReader();
   try{if(reader)for(;;){combined.throwIfAborted();const {done,value:chunk}=await reader.read();if(done)break;bytes+=chunk.byteLength;if(bytes>maxBytes)throw Error('Global Payments byte limit');chunks.push(Buffer.from(chunk));}}
   catch(error){await reader?.cancel().catch(()=>{});throw error;}finally{reader?.releaseLock();}
   combined.throwIfAborted();return {status:response.status,url,body:Buffer.concat(chunks,bytes),provenance:{requestedURL:value,finalURL:url,method:'GET',anonymous:true,cookiesSent:false,startedAt,completedAt:new Date().toISOString(),publicResponseDateRaw:response.headers.get('date'),bodyBytes:bytes}};
  }throw Error('Redirect limit');}finally{clearTimeout(timer);}
 };
}
