import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'

const SOURCE='simplify3xsoftware',LIMITS={sourceTimeoutMs:90000,requestTimeoutMs:15000,maxRequests:8,maxEntityBytes:4*1024*1024,maxTotalBytes:32*1024*1024}
const fail=message=>firstPartyFailure(SOURCE,message),need=(ok,message)=>{if(!ok)throw fail(message)}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{/* Disposal preserves the original failure. */}}
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
// Current native programs require their declared JavaScript MIME and independent
// non-executing business-protocol checks. No program or application is activated.
const mimes={html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,json:/^application\/json(?:;|$)/i,javascript:/^(?:text|application)\/(?:x-)?(?:java|ecma)script(?:;|$)/i,embeddedProgram:/^(?:text\/html|(?:text|application)\/(?:x-)?(?:java|ecma)script)(?:;|$)/i,application:/^(?:text\/html|text\/plain|application\/json|application\/xhtml\+xml)(?:;|$)/i}

export function createCurrentReader(options,allowedURL){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'original Response transport required')
 const limits=Object.fromEntries(Object.entries(LIMITS).map(([name,ceiling])=>{const value=options[name]??ceiling;need(Number.isSafeInteger(value)&&value>0&&value<=ceiling,'invalid '+name+' bound');return[name,value]}))
 const interval=options.requestIntervalMs??500;need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid native request spacing')
 const owner=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,owner.signal]):owner.signal
 const timer=setTimeout(()=>owner.abort(new DOMException(SOURCE+' source deadline exceeded','TimeoutError')),limits.sourceTimeoutMs)
 const responses=[],denied=new Set();let total=0,next=0,inFlight=false
 const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted()}
 return {check,isDenied:url=>denied.has(new URL(url).origin),close(){clearTimeout(timer);owner.abort()},async callback(fn,value){check();let listener;try{return await Promise.race([Promise.resolve().then(()=>fn(value)),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})])}finally{if(listener)signal.removeEventListener('abort',listener)}},stats:()=>({...limits,requestIntervalMs:interval,requests:responses.length,decodedBytes:total,deniedOrigins:[...denied],originalResponses:structuredClone(responses)}),async read(url,{kind='html',phase='opening',allowedStatuses=[200]}={}){
  check();need(!denied.has(new URL(url).origin),'native origin already denied');need(total<limits.maxTotalBytes,'native aggregate byte ceiling already reached');need(!inFlight&&responses.length<limits.maxRequests&&mimes[kind]&&allowedURL(url,kind),'unbound, concurrent or excessive native read');inFlight=true;let activeReceipt=null
  try{
   if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
   check();next=performance.now()+interval
   const receipt=activeReceipt={requestedUrl:url,phase,method:'GET',bodyComplete:false};responses.push(receipt)
   const page=await boundedDeclaredPublicGet(url,{signal,timeoutMs:limits.requestTimeoutMs,overflowError:fail('native streaming byte ceiling exceeded'),fetchImpl:async(requested,init)=>{
    let response
    try{
     response=await(options.fetchImpl??fetch)(requested,{...init,credentials:'omit',cache:'no-store'});check();init.signal.throwIfAborted();receipt.observedStatus=response?.status??null
     need(response&&typeof response.headers?.get==='function'&&response.url===url&&response.redirected===false,'original native HTTP identity or redirect metadata changed')
     Object.assign(receipt,{status:response.status,url:response.url,redirected:response.redirected,headers:Object.fromEntries(response.headers)})
     if([202,401,402,403,406,407,429,451].includes(response.status)||isHttpAccessChallenge(response))denied.add(new URL(url).origin)
     if(response.status===200||!allowedStatuses.includes(response.status))await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},url,{context:SOURCE+' current read',signal:init.signal,callerSignal:options.signal??null})
     need(allowedStatuses.includes(response.status),'current native HTTP status requires review')
     need(mimes[kind].test(response.headers.get('content-type')??'')||response.status!==200&&mimes.application.test(response.headers.get('content-type')??''),'native MIME changed')
     let entity=0;const body=response.body
     return {status:response.status,url:response.url,headers:response.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){const reader=body.getReader();return{async read(){check();init.signal.throwIfAborted();const chunk=await reader.read();check();init.signal.throwIfAborted();if(!chunk.done){need(types.isUint8Array(chunk.value),'native stream is not bytes');const size=byteLength.call(chunk.value);entity+=size;total+=size;need(entity<=limits.maxEntityBytes&&total<=limits.maxTotalBytes,'native entity or aggregate byte ceiling exceeded')}return chunk},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}}
    }catch(error){ignore(()=>response?.body?.cancel(error));throw error}
   }})
   check();const bytes=Buffer.from(page.bodyBase64,'base64');Object.assign(receipt,{bodyComplete:true,bytes:bytes.length,sha256:digest(bytes)})
   const charset=page.headers['content-type']?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]??'utf-8'
   need(/^(?:utf-8|utf8|iso-8859-1|windows-1252)$/i.test(charset),'unsupported declared native encoding')
   const text=new TextDecoder(charset,{fatal:true}).decode(bytes);check();return {...page,text,sha256:receipt.sha256,redirected:false}
  }catch(error){check();if(activeReceipt?.observedStatus===200&&error instanceof Error)Object.assign(error,{failureKind:'parser_or_contract_error',nativeHttpStatus:200});throw error}finally{inFlight=false}
 }}
}
