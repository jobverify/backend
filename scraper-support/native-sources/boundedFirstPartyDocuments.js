import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from './boundedDeclaredPublicGet.js'

export const firstPartyFailure=(source,message,fields={})=>Object.assign(Error(source+' native careers: '+message),{
 abortRetries:true,softFailure:true,lifecycleCleanupAllowed:false,...fields})
export function createFirstPartyDocumentReader(options,{source,urls,roleURL=()=>false,redirects={},requestTimeoutCeilingMs=15000}){
 const failure=(message,fields)=>firstPartyFailure(source,message,fields),caller=options.signal
 caller?.throwIfAborted()
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000
 if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<1||sourceTimeoutMs>180000
  ||!Number.isSafeInteger(requestTimeoutCeilingMs)||requestTimeoutCeilingMs<1||requestTimeoutCeilingMs>60000
  ||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>requestTimeoutCeilingMs)throw RangeError('Invalid first-party source/request deadline')
 const started=performance.now(),controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const timeout=setTimeout(()=>controller.abort(new DOMException(source+' source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 const permitted=new Set(urls),receipts=[]
 let nextStart=0,decodedBytes=0
 const check=()=>{
  caller?.throwIfAborted()
  if(performance.now()-started>=sourceTimeoutMs&&!controller.signal.aborted)controller.abort(new DOMException(source+' source deadline exceeded','TimeoutError'))
  signal.throwIfAborted()
 }
 return {check,
  allowRole(url){if(!roleURL(url))throw failure('Unbound native role URL');permitted.add(url)},
  async read(url){
   check();if(!permitted.has(url)||receipts.length>=96)throw failure('Unbound public URL or request budget exceeded')
   if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal})
   check();nextStart=performance.now()+500
   const receipt={requestedUrl:url,method:'GET',requestedAt:new Date().toISOString(),status:null,bodyComplete:false,bodyUnavailable:false}
   receipts.push(receipt)
   const requestStarted=performance.now(),deadline=new AbortController(),reason=new DOMException(source+' request deadline exceeded','TimeoutError')
   const timer=setTimeout(()=>deadline.abort(reason),requestTimeoutMs),requestSignal=AbortSignal.any([signal,deadline.signal])
   const checkRequest=()=>{
    check();if(performance.now()-requestStarted>=requestTimeoutMs&&!deadline.signal.aborted)deadline.abort(reason)
    requestSignal.throwIfAborted()
   }
   const acquire=async(requested,init)=>{
    checkRequest()
    let response
    if(options.fetchImpl)response=await options.fetchImpl(requested,{...init,credentials:'omit',cache:'no-store'})
    else if(options.fetchPage){
     const page=await options.fetchPage(requested,{...init,format:'html'})
     if(init.signal.aborted){try{Promise.resolve(page?.body?.cancel?.(init.signal.reason)).catch(()=>{})}catch{};init.signal.throwIfAborted()}
     const unavailable=page?.bodyUnavailable===true
     if(unavailable&&!(page.status===301&&redirects[requested]&&page.body===null))throw failure('Unavailable native body cannot qualify a source document')
     if(!unavailable&&(typeof page?.body!=='string'||Buffer.byteLength(page.body)>16*1024*1024))throw failure('Missing or oversized injected original HTML')
     receipt.bodyUnavailable=unavailable
     response=new Response(unavailable?null:page.body,{status:page.status,headers:page.headers})
     Object.defineProperty(response,'url',{value:page.finalUrl??page.url??requested})
    }else if(options.fetchText){
     const text=await options.fetchText(requested,init)
     checkRequest();if(typeof text!=='string'||Buffer.byteLength(text)>16*1024*1024)throw failure('Invalid legacy text callback body')
     receipt.legacyCallbackMetadataUnverified=true
     response=new Response(text,{status:200,headers:{'content-type':'text/html'}})
     Object.defineProperty(response,'url',{value:requested})
    }else response=await fetch(requested,{...init,credentials:'omit',cache:'no-store'})
    try{
     checkRequest();const body=response.body;checkRequest()
     return {status:response.status,url:response.url,headers:response.headers,body:body===null?null:{
      cancel:value=>body.cancel?.(value),getReader(){
       checkRequest();const reader=body.getReader()
       return {async read(){checkRequest();const chunk=await reader.read();checkRequest();return chunk},
        cancel:value=>reader.cancel(value),releaseLock:()=>reader.releaseLock()}
      },
     }}
    }catch(error){try{Promise.resolve(response?.body?.cancel?.(error)).catch(()=>{})}catch{};throw error}
   }
   try{
    const response=await boundedDeclaredPublicGet(url,{signal:requestSignal,timeoutMs:requestTimeoutMs,fetchImpl:acquire,overflowError:failure('Original response byte budget exceeded')})
    checkRequest();Object.assign(receipt,{status:response.status,finalUrl:response.url})
    // Every acquired entity consumes the aggregate budget, including redirects
    // and errors. A declared unavailable capture is distinct from an empty or
    // nonempty entity that the transport actually delivered.
    const bytes=Buffer.from(response.bodyBase64,'base64');decodedBytes+=bytes.length
    Object.assign(receipt,receipt.bodyUnavailable?{bodyComplete:false,bytes:null,sha256:null}:
     {bodyComplete:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
    if(decodedBytes>32*1024*1024)throw failure('Aggregate native HTML byte budget exceeded')
    if(response.url!==url)throw failure('Original final URL changed',{status:response.status})
    if(response.status===301&&redirects[url]){
     let target;try{target=new URL(response.headers.location,url).href}catch{}
     if(target!==redirects[url])throw failure('Declared careers redirect changed',{status:301})
     return {url,status:301,headers:response.headers,body:null,bodyBase64:receipt.bodyUnavailable?null:response.bodyBase64,bodyUnavailable:receipt.bodyUnavailable,declaredTarget:target}
    }
    if(response.status!==200)throw failure('Original source HTTP '+response.status,{status:response.status,
     failureKind:[401,403,429,451].includes(response.status)?'blocked_or_access_denied':response.status>=500?'network_or_timeout':'surface_drift_or_fail_closed'})
    if(!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers['content-type']??''))throw failure('Unexpected original HTML MIME')
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    Object.assign(receipt,{bodyComplete:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
    checkRequest();return {url,status:200,headers:response.headers,body:text,bodyUnavailable:false,sha256:receipt.sha256}
   }catch(error){if(caller?.aborted)throw caller.reason;try{checkRequest()}catch(expired){throw expired};throw error}
   finally{clearTimeout(timer);receipt.completedAt=new Date().toISOString()}
  },
  stats:()=>({requests:receipts.length,decodedBytes,receipts:structuredClone(receipts),nativeRequestIntervalMs:500,requestTimeoutMs,sourceTimeoutMs,
   byteQualification:'16MiB hard per-response streaming ceiling;32MiB aggregate checked after each bounded response. At most one extra bounded response is acquired before aggregate rejection.'}),
  close(){clearTimeout(timeout);controller.abort()},
 }
}
