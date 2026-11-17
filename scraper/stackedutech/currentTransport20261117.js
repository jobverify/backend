// Source-local copy of boundedCurrentNativeRead20261106.js SHA256 e6f92fc41ea389dd52dca69ae1bc49ea41a3b143f68c60007d1d88f0b0006387; URL validation additionally admits only the independently configured exact http://stackedutech.com/ root. No automatic upgrade or redirects.
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'

const mimes={html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,json:/^application\/json(?:;|$)/i,javascript:/^(?:(?:text|application)\/(?:x-)?javascript|text\/js)(?:;|$)/i}
const validURL=value=>{try{const url=new URL(value);return url.href===value&&(url.protocol==='https:'||value==='http://stackedutech.com/')&&!url.username&&!url.password&&!url.hash}catch{return false}}
const cancel=(body,reason)=>{try{Promise.resolve(body?.cancel?.(reason)).catch(()=>{})}catch{}}
export function createStackCurrentReader(options,{source,admitted,learnedURL=()=>false,requests=[]}){
 const fail=(message,fields)=>firstPartyFailure(source,message,fields),caller=options.signal
 caller?.throwIfAborted()
 if(options.fetchText||options.fetchJson)throw fail('Original HTTP metadata is required; body-only callbacks cannot certify a native source')
 const sourceTimeoutMs=options.sourceTimeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??15000
 if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<1||sourceTimeoutMs>180000||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw RangeError('Invalid native source/request deadline')
 const permitted=new Map(admitted),queries=new Map(),receipts=[],started=performance.now(),controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 for(const [url,kind] of permitted)if(!validURL(url)||!mimes[kind])throw fail('Invalid initial native URL admission')
 for(const [url,request] of requests){
  if(queries.has(url)||permitted.get(url)!=='json'||!request||request.method!=='POST'||typeof request.body!=='string'||!request.body||Buffer.byteLength(request.body)>1024||Object.keys(request).some(key=>!['method','body'].includes(key)))throw fail('Invalid source-declared native read-only query')
  queries.set(url,Object.freeze({method:'POST',body:request.body}))
 }
 const timer=setTimeout(()=>controller.abort(new DOMException(source+' source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 let decodedBytes=0,nextStart=0,inFlight=false,closed=false
 const check=()=>{
  caller?.throwIfAborted()
  if(performance.now()-started>=sourceTimeoutMs&&!controller.signal.aborted)controller.abort(new DOMException(source+' source deadline exceeded','TimeoutError'))
  signal.throwIfAborted();if(closed)throw fail('Native source reader is closed')
 }
 return {check,
  allow(url,kind){check();if(!validURL(url)||!mimes[kind]||!learnedURL(url,kind)||permitted.has(url)&&permitted.get(url)!==kind)throw fail('Unbound learned native URL');permitted.set(url,kind)},
  async read(url){
   check();const kind=permitted.get(url)
   if(!kind||receipts.length>=96||inFlight)throw fail('Unbound, concurrent or excessive native request')
   inFlight=true
   let deadlineTimer,receipt,observedHTTPError
   try{
    if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal})
    check();nextStart=performance.now()+500
    const request=queries.get(url)??{method:'GET'}
    receipt={requestedUrl:url,method:request.method,...(request.body?{requestBodyBytes:Buffer.byteLength(request.body),requestBodySHA256:createHash('sha256').update(request.body).digest('hex')}:{}),requestedAt:new Date().toISOString(),status:null,bodyComplete:false};receipts.push(receipt)
    const requestStarted=performance.now(),deadline=new AbortController(),reason=new DOMException(source+' request deadline exceeded','TimeoutError'),requestSignal=AbortSignal.any([signal,deadline.signal])
    deadlineTimer=setTimeout(()=>deadline.abort(reason),requestTimeoutMs)
    const requestCheck=()=>{check();if(performance.now()-requestStarted>=requestTimeoutMs&&!deadline.signal.aborted)deadline.abort(reason);requestSignal.throwIfAborted()}
    const acquire=async(requested,init)=>{
     requestCheck();let response,page
     if(options.fetchImpl)response=await options.fetchImpl(requested,{...init,credentials:'omit',cache:'no-store'})
     else if(options.fetchPage){
      page=await options.fetchPage(requested,{...init,credentials:'omit',cache:'no-store',format:kind})
      if(!page?.headers||!Number.isInteger(page.status)||typeof (page.finalUrl??page.url)!=='string')throw fail('Incomplete original native HTTP metadata')
      response={status:page.status,url:page.finalUrl??page.url,headers:new Headers(page.headers),body:null}
     }else response=await fetch(requested,{...init,credentials:'omit',cache:'no-store'})
     try{
      caller?.throwIfAborted()
      const status=response.status,observedURL=response.url,headers=response.headers
      Object.assign(receipt,{status,finalUrl:observedURL,headers:Object.fromEntries(headers)})
      try{
       // Preserve observed HTTP evidence before an error entity can stall or
       // fail. Dispose independently; caller cancellation still takes priority.
       await requireNativeHttpResponse({status,url:observedURL,headers,body:null},requested,
        {context:source+' current native read',signal:init.signal,callerSignal:caller??null})
      }catch(error){
       observedHTTPError=error
       disposeResponseBody(response,{bestEffort:true}).catch(()=>{})
       throw error
      }
      requestCheck()
      let body=response.body
      if(page){
       if(page.bodyUnavailable===true||typeof page.body!=='string'||Buffer.byteLength(page.body)>16*1024*1024)throw fail('Missing, unavailable or oversized original native entity')
       body=new Response(page.body).body
      }
      requestCheck()
      return {status,url:observedURL,headers,body:body===null?null:{cancel:reason=>body.cancel?.(reason),getReader(){
       requestCheck();const reader=body.getReader()
       try{requestCheck()}catch(error){cancel(reader,error);try{reader.releaseLock()}catch{}throw error}
       return {async read(){requestCheck();const value=await reader.read();requestCheck();return value},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}}
     }catch(error){if(!observedHTTPError)cancel(response?.body,error);throw error}
    }
    try{
     const response=await boundedDeclaredPublicRead(url,{request,signal:requestSignal,fetchImpl:acquire,overflowError:fail('Original native response byte budget exceeded')})
     requestCheck();const bytes=Buffer.from(response.bodyBase64,'base64');decodedBytes+=bytes.length
     Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:response.headers,bodyComplete:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
     if(decodedBytes>32*1024*1024)throw fail('Aggregate original native byte budget exceeded')
     if(response.url!==url)throw fail('Original native final URL changed',{status:response.status})
     if(response.status!==200)throw fail('Original native HTTP '+response.status,{status:response.status,requestUrl:url,failureKind:[401,403,429,451].includes(response.status)?'blocked_or_access_denied':response.status>=500?'network_or_timeout':'surface_drift_or_fail_closed'})
     if(!mimes[kind].test(response.headers['content-type']??''))throw fail('Original native '+kind+' MIME changed')
     const body=new TextDecoder('utf8',{fatal:true}).decode(bytes);requestCheck()
     return {url,status:200,headers:response.headers,body,sha256:receipt.sha256}
    }catch(error){if(caller?.aborted)throw caller.reason;if(observedHTTPError)throw observedHTTPError;requestCheck();throw error}
   }catch(error){if(caller?.aborted)throw caller.reason;if(observedHTTPError)throw observedHTTPError;signal.throwIfAborted();throw error}
   finally{if(deadlineTimer)clearTimeout(deadlineTimer);if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
  },
  stats:()=>({requests:receipts.length,decodedBytes,receipts:structuredClone(receipts),nativeRequestIntervalMs:500,requestTimeoutMs,sourceTimeoutMs,
   byteQualification:'16MiB hard per-response streaming ceiling;32MiB aggregate checked after each bounded response, with at most one additional bounded response before aggregate rejection.'}),
  close(){closed=true;clearTimeout(timer);controller.abort()},
 }
}
