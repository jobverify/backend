import {setTimeout as delay} from 'node:timers/promises'
import {CAREERS,isRoleURL,isPDFURL,need,hash} from './nativeModels.js'
export function createLogelitePublicRead(options,receipts){
 const interval=options.minIntervalMs??1000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const deadline=setTimeout(()=>controller.abort(Error('Logelite source deadline')),180000),fetchImpl=options.fetchImpl||globalThis.fetch
 const allowed=new Set([CAREERS]),cancel=value=>{try{Promise.resolve(value?.cancel()).catch(()=>{})}catch{}}
 let total=0,last=0,stopped=false
 const read=async url=>{
  signal.throwIfAborted();need(!stopped&&allowed.has(url)&&receipts.length<64,'stopped source, unreviewed URL or request bound')
  const waiting=interval-(Date.now()-last);if(waiting>0)await delay(waiting,undefined,{signal});signal.throwIfAborted();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]);let response,reader,listener
  const timer=setTimeout(()=>local.abort(Error('Logelite request deadline')),20000)
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true});if(combined.aborted)listener()})
  try{return await Promise.race([(async()=>{
   const pdf=isPDFURL(url)
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:pdf?'application/pdf':'text/html'},signal:combined})
   if(combined.aborted){cancel(response.body);combined.throwIfAborted()}
   need(response.url===url,'observed HTTP URL changed')
   const receipt={url,method:'GET',kind:pdf?'pdf':'html',status:response.status,bodySHA256:null,httpMetadataVerified:true};receipts.push(receipt)
   if(response.status!==200)throw Object.assign(Error('Logelite native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   need((pdf?/^application\/pdf\b/i:/^text\/html\b/i).test(response.headers.get('content-type')||''),'native response MIME changed')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase()
   need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised response bound')
   need(!encoding||['identity','gzip','br','deflate'].includes(encoding),'unreviewed response encoding')
   reader=response.body?.getReader();need(reader,'native response stream missing');const chunks=[];let bytes=0
   for(;;){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break
    bytes+=part.value.byteLength;total+=part.value.byteLength;need(bytes<=4000000&&total<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===bytes,'native body length mismatch')
   const body=Buffer.concat(chunks);receipt.bodySHA256=hash(body);receipt.bodyBytes=body.length
   if(pdf)receipt.bodyBase64=body.toString('base64');else receipt.rawHTML=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(body)
   return {bytes:body,receipt}
  })(),interrupted])}catch(error){stopped=true;throw error}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);cancel(reader||response?.body)}
 }
 return {signal,read,allow:url=>{need(isRoleURL(url)||isPDFURL(url),'declared URL outside official role/PDF surfaces');allowed.add(url)},close:()=>{clearTimeout(deadline);controller.abort()}}
}
