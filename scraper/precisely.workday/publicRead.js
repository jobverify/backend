import {setTimeout as delay} from 'node:timers/promises'
import {CAREERS,DECLARED_INTERNATIONAL,INTERNATIONAL,FEED,need,hash} from './nativeModels.js'
export function createPreciselyPublicRead(options,receipts){
 const interval=options.minIntervalMs??1000;need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,deadline=setTimeout(()=>controller.abort(Error('Precisely source deadline')),180000),fetchImpl=options.fetchImpl||globalThis.fetch,allowed=new Set([CAREERS])
 const cancel=v=>{try{Promise.resolve(v?.cancel()).catch(()=>{})}catch{}};let total=0,last=0,stopped=false
 const read=async url=>{
  signal.throwIfAborted();need(!stopped&&allowed.has(url)&&receipts.length<32,'stopped source, undeclared URL or request bound');const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]),timer=setTimeout(()=>local.abort(Error('Precisely request deadline')),20000);let response,reader,listener
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true});if(combined.aborted)listener()})
  try{return await Promise.race([(async()=>{
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:url===FEED?'application/json':'text/html'},signal:combined});if(combined.aborted){cancel(response.body);combined.throwIfAborted()}
   need(response.url===url,'observed HTTP URL changed');const receipt={url,method:'GET',kind:url===FEED?'json':'html',status:response.status,bodySHA256:null,httpMetadataVerified:true};receipts.push(receipt)
   const redirect=url===DECLARED_INTERNATIONAL&&response.status===301;if(response.status!==200&&!redirect)throw Object.assign(Error('Precisely native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   if(url===DECLARED_INTERNATIONAL)need(redirect&&response.headers.get('location')===INTERNATIONAL,'declared canonical redirect changed');if(redirect)receipt.location=response.headers.get('location')
   need((url===FEED?/^application\/json\b/i:/^text\/html\b/i).test(response.headers.get('content-type')||''),'native response MIME changed')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase();need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised response bound');need(!encoding||['identity','gzip','br','deflate'].includes(encoding),'unreviewed response encoding')
   reader=response.body?.getReader();need(reader,'native response stream missing');const chunks=[];let size=0;for(;;){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break;size+=part.value.byteLength;total+=part.value.byteLength;need(size<=4000000&&total<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===size,'native body length mismatch');const bytes=Buffer.concat(chunks);receipt.bodyBytes=bytes.length;receipt.bodySHA256=hash(bytes);receipt.rawText=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes);return receipt
  })(),interrupted])}catch(error){stopped=true;throw error}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);cancel(reader||response?.body)}
 }
 return {signal,read,allow:url=>{need([DECLARED_INTERNATIONAL,INTERNATIONAL,FEED].includes(url),'unreviewed declared public URL');allowed.add(url)},close:()=>{clearTimeout(deadline);controller.abort()}}
}
