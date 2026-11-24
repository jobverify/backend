import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'

export const need=(ok,message)=>{if(!ok)throw Object.assign(new Error('[lemonade] '+message),{failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export const HOME='https://www.mylemonade.io/'
export const CAREER=HOME+'career/'
export const CLIENT=HOME+'main.js'
const routes=new Map([[HOME,'html'],[CAREER,'html'],[CLIENT,'js']])

export function createLemonadeReader(options={}){
 const caller=options.signal
 caller?.throwIfAborted()
 need(!['fetchPage','fetchText','fetchBrowserText','fetchProtocolTolerantText','probeUrl'].some(key=>options[key]),'metadata-free acquisition callbacks are unsupported')
 const sourceMs=options.sourceTimeoutMs??90000,requestMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500,maxReads=options.maxRequests??6
 need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=90000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=15000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500)&&Number.isSafeInteger(maxReads)&&maxReads>0&&maxReads<=6,'invalid public request bounds')
 const owner=new AbortController(),started=performance.now(),sourceError=new DOMException('Lemonade public source deadline exceeded','TimeoutError'),timer=setTimeout(()=>owner.abort(sourceError),sourceMs)
 const signal=caller?AbortSignal.any([caller,owner.signal]):owner.signal,receipts=[],documents=[],work=new Set(),disposed=new WeakSet()
 let total=0,next=0,inFlight=false,closed=false,lateHTTPError=null
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=sourceMs&&!owner.signal.aborted)owner.abort(sourceError);signal.throwIfAborted()}
 const track=p=>{work.add(p);p.then(()=>work.delete(p),()=>work.delete(p));return p}
 const cancelBody=async response=>{const body=response?.body;if(!body||!['object','function'].includes(typeof body)||disposed.has(body))return;disposed.add(body);try{await disposeResponseBody(response,{bestEffort:true})}catch{/* Keep the observed failure. */}}
 const cancelReader=async(reader,body)=>{if(body)disposed.add(body);try{await disposeResponseReader(reader,{bestEffort:true})}catch{/* Keep the observed failure. */}}
 const within=(promise,requestSignal)=>new Promise((resolve,reject)=>{
  let settled=false
  const finish=(fn,value)=>{if(settled)return;settled=true;requestSignal.removeEventListener('abort',abort);fn(value)}
  const abort=()=>finish(reject,caller?.aborted?caller.reason:requestSignal.reason)
  requestSignal.addEventListener('abort',abort,{once:true});if(requestSignal.aborted)abort()
  Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,caller?.aborted?caller.reason:error))
 })
 const settleOwned=async pending=>{let grace;try{await Promise.race([Promise.allSettled([pending]),new Promise(resolve=>{grace=setTimeout(resolve,1000)})])}finally{clearTimeout(grace)}}
 async function acquire(url,init,receipt){
  let abandoned=false
  const pending=Promise.resolve().then(()=>{check();need(!closed,'public reader closed');return(options.fetchImpl??globalThis.fetch)(url,init)})
  const observed=pending.then(async response=>{
   if(abandoned||closed||init.signal.aborted){
    try{
     if(response&&typeof response.headers?.get==='function'){
      Object.assign(receipt,{status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')??'',observedAfterReadOwnershipEnded:true})
      // A late denial/identity failure is still observed native HTTP. No body
      // is admitted, and an expired local clock cannot erase that status.
      try{await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},url,{context:'Lemonade late public native HTTP',signal:null,callerSignal:null})}catch(error){lateHTTPError=error}
     }
    }finally{await cancelBody(response)}
    return null
   }
   return response
  })
  track(observed)
  try{return await within(observed,init.signal)}catch(error){
   abandoned=true;await settleOwned(observed);caller?.throwIfAborted()
   if(lateHTTPError)throw lateHTTPError
   throw error
  }
 }
 return{
  check,
  stats:()=>({requests:receipts.length,decodedBytes:total,receipts:structuredClone(receipts),sourceTimeoutMs:sourceMs,requestTimeoutMs:requestMs,requestIntervalMs:interval}),
  documents:()=>structuredClone(documents),
  async read(url){
   check();need(routes.has(url)&&!closed&&!inFlight&&receipts.length<maxReads,'unbound/concurrent/excessive public read')
   inFlight=true;let response,reader,requestTimer,receipt,requestSignal
   try{
    if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
    check();next=performance.now()+interval
    const requestOwner=new AbortController();requestTimer=setTimeout(()=>requestOwner.abort(new DOMException('Lemonade public request deadline exceeded','TimeoutError')),requestMs)
    requestSignal=AbortSignal.any([signal,requestOwner.signal])
    receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
    response=await acquire(url,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:routes.get(url)==='html'?'text/html':'application/javascript'},signal:requestSignal},receipt)
    caller?.throwIfAborted();need(response&&typeof response.headers?.get==='function','public HTTP metadata missing')
    Object.assign(receipt,{status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')??''})
    await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},url,{context:'Lemonade public native HTTP',signal:requestSignal,callerSignal:caller??null})
    requestSignal.throwIfAborted()
    const mime=routes.get(url)==='html'?/^text\/html(?:[ \t]*;[^\r\n]*)?$/i:/^(?:application|text)\/javascript(?:[ \t]*;[^\r\n]*)?$/i
    need(mime.test(receipt.contentType),'public HTTP MIME changed before body admission')
    const length=response.headers.get('content-length')
    need(length===null||/^\d+$/.test(length)&&Number.isSafeInteger(Number(length))&&Number(length)<=2097152,'public declared entity byte ceiling or invalid length')
    need(typeof response.body?.getReader==='function','public body unavailable')
    reader=response.body.getReader();let count=0;const chunks=[]
    for(;;){
     check();requestSignal.throwIfAborted()
     const part=await within(Promise.resolve().then(()=>{requestSignal.throwIfAborted();return reader.read()}),requestSignal)
     need(part&&typeof part.done==='boolean','invalid public stream result');if(part.done)break
     need(part.value instanceof Uint8Array,'public byte stream required');count+=part.value.byteLength
     need(count<=2097152,'public entity byte ceiling');chunks.push(Buffer.from(part.value))
    }
    check();requestSignal.throwIfAborted();const bytes=Buffer.concat(chunks);total+=bytes.length
    need(total<=8388608,'public aggregate byte ceiling')
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
    Object.assign(receipt,{bodyComplete:true,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
    const result={url,text,sha256:receipt.bodySHA256};documents.push(result);return result
   }finally{
    clearTimeout(requestTimer)
    if(reader)await cancelReader(reader,response?.body);else if(response)await cancelBody(response)
    if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false
    caller?.throwIfAborted()
   }
  },
  async close(){
   closed=true;clearTimeout(timer);owner.abort()
   if(work.size){let grace;try{await Promise.race([Promise.allSettled([...work]),new Promise(resolve=>{grace=setTimeout(resolve,1000)})])}finally{clearTimeout(grace)}}
   caller?.throwIfAborted()
   return lateHTTPError
  },
 }
}
