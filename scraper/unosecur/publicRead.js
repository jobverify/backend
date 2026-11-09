import {setTimeout as delay} from 'node:timers/promises'
import {CAREERS,isRoleURL,isClientURL,need,hash} from './nativeModels.js'
const isAPI=value=>{try{const u=new URL(value);return u.origin==='https://app.reczee.com'&&!u.username&&!u.password&&!u.port&&!u.hash&&/^\/api\/v1\/requisitions\/from-slug\/[A-Za-z0-9]+$/.test(u.pathname)&&u.search==='?company_slug=unosecur'}catch{return false}}
export function createUnosecurPublicRead(options,receipts){
 const interval=options.minIntervalMs??1000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const deadline=setTimeout(()=>controller.abort(Error('Unosecur source deadline')),180000),fetchImpl=options.fetchImpl||globalThis.fetch
 const allowed=new Map([[CAREERS,'html']]),cancel=value=>{try{Promise.resolve(value?.cancel()).catch(()=>{})}catch{}}
 let total=0,last=0,stopped=false
 const read=async url=>{
  signal.throwIfAborted();need(!stopped&&allowed.has(url)&&receipts.length<64,'stopped source, unreviewed URL or request bound')
  const waiting=interval-(Date.now()-last);if(waiting>0)await delay(waiting,undefined,{signal});signal.throwIfAborted();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]);let response,reader,listener
  const timer=setTimeout(()=>local.abort(Error('Unosecur request deadline')),20000),kind=allowed.get(url)
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true});if(combined.aborted)listener()})
  try{return await Promise.race([(async()=>{
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:kind==='html'?'text/html':kind==='json'?'application/json':'application/javascript,text/javascript'},signal:combined})
   if(combined.aborted){cancel(response.body);combined.throwIfAborted()}
   need(response.url===url,'observed native HTTP URL changed')
   const receipt={url,method:'GET',kind,status:response.status,bodySHA256:null,httpMetadataVerified:true};receipts.push(receipt)
   if(response.status!==200)throw Object.assign(Error('Unosecur native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   const mime=response.headers.get('content-type')||''
   need((kind==='html'?/^text\/html\b/i:kind==='json'?/^application\/json\b/i:/^(?:application|text)\/javascript\b/i).test(mime),'native response MIME changed')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase()
   need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised native response bound')
   need(!encoding||['identity','gzip','br','deflate'].includes(encoding),'unreviewed native response encoding')
   reader=response.body?.getReader();need(reader,'native response body stream missing');const chunks=[];let bytes=0
   for(;;){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break;bytes+=part.value.byteLength;total+=part.value.byteLength
    need(bytes<=4000000&&total<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===bytes,'native body length mismatch')
   const body=Buffer.concat(chunks);receipt.bodySHA256=hash(body);receipt.bodyBytes=body.length;receipt.rawText=new TextDecoder('utf8',{fatal:true}).decode(body)
   return {bytes:body,receipt}
  })(),interrupted])}catch(error){stopped=true;throw error}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);cancel(reader||response?.body)}
 }
 return {read,allow:(url,kind)=>{need(kind==='html'&&isRoleURL(url)||kind==='javascript'&&isClientURL(url)||kind==='json'&&isAPI(url),'URL outside declared native surfaces');allowed.set(url,kind)},close:()=>{clearTimeout(deadline);controller.abort()}}
}
