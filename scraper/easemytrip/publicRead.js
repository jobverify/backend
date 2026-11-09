import {setTimeout as delay} from 'node:timers/promises'
import {HOME,CAREERS,CONTACT,ABOUT,need,hash} from './nativeModels.js'
export function createEaseMyTripPublicRead(options,receipts){
 const interval=options.minIntervalMs??1000,budget=options.timeoutMs??180000,requestBudget=options.requestTimeoutMs??20000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'),'invalid public pacing');need(Number.isFinite(budget)&&budget>0&&budget<=180000&&Number.isFinite(requestBudget)&&requestBudget>0&&requestBudget<=20000,'invalid public deadline')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,expires=performance.now()+budget,timer=setTimeout(()=>controller.abort(Error('EaseMyTrip source deadline')),budget),fetchImpl=options.fetchImpl||globalThis.fetch,allowed=new Set([HOME])
 const check=()=>{if(performance.now()>=expires&&!controller.signal.aborted)controller.abort(Error('EaseMyTrip source deadline'));signal.throwIfAborted()},cancel=v=>{try{Promise.resolve(v?.cancel()).catch(()=>{})}catch{}};let total=0,last=0,stopped=false
 const read=async(url,{stylesheet=false}={})=>{
  check();need(!stopped&&allowed.has(url)&&receipts.length<32,'stopped source, undeclared URL or request bound');const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});check();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]),deadline=setTimeout(()=>local.abort(Error('EaseMyTrip request deadline')),requestBudget);let response,reader,listener
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true});if(combined.aborted)listener()})
  try{return await Promise.race([(async()=>{
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:stylesheet?'text/css':'text/html'},signal:combined});if(combined.aborted){cancel(response.body);combined.throwIfAborted()}check()
   need(response.url===url,'observed public HTTP URL changed');const receipt={url,method:'GET',kind:stylesheet?'css':'html',status:response.status,bodySHA256:null,httpMetadataVerified:true};receipts.push(receipt)
   if(response.status!==200)throw Object.assign(Error('EaseMyTrip native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   need((stylesheet?/^text\/css\b/i:/^text\/html\b/i).test(response.headers?.get?.('content-type')||''),'public HTTP MIME metadata changed')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase();need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised response bound');need(!encoding||['identity','gzip','br','deflate'].includes(encoding),'unreviewed response encoding')
   reader=response.body?.getReader();need(reader,'public streaming body missing');const chunks=[];let size=0
   for(;;){check();combined.throwIfAborted();const part=await reader.read();check();combined.throwIfAborted();if(part.done)break;need(part.value instanceof Uint8Array,'invalid stream chunk');size+=part.value.byteLength;total+=part.value.byteLength;need(size<=4000000&&total<=32000000,'public response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===size,'original HTTP body length mismatch');const bytes=Buffer.concat(chunks);receipt.bodyBytes=bytes.length;receipt.bodySHA256=hash(bytes);receipt.rawText=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes);return receipt
  })(),interrupted])}catch(error){stopped=true;throw error}finally{clearTimeout(deadline);combined.removeEventListener('abort',listener);cancel(reader||response?.body)}
 }
 return {read,check,allow:url=>{need([CAREERS,CONTACT,ABOUT].includes(url),'unreviewed official public URL');allowed.add(url)},allowStylesheet:value=>{const url=new URL(value);need(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash&&['css.emtcontent.com','fonts.googleapis.com'].includes(url.hostname),'unreviewed declared stylesheet authority');allowed.add(url.href)},close:()=>{clearTimeout(timer);controller.abort()}}
}
