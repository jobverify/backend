import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'

const SOURCE='pena4techsolutions',LIMITS={sourceTimeoutMs:300000,requestTimeoutMs:25000,maxRequests:140,maxEntityBytes:4*1024*1024,maxTotalBytes:40*1024*1024}
const fail=message=>firstPartyFailure(SOURCE,message),need=(ok,message)=>{if(!ok)throw fail(message)}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{/* Best-effort disposal must not replace the original transport failure. */}}
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const mimes={html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,json:/^application\/json(?:;|$)/i,javascript:/^(?:text|application)\/(?:x-)?(?:java|ecma)script(?:;|$)/i}

export function createCurrentReader(options,allowedURL){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'original Response transport required')
 const limits=Object.fromEntries(Object.entries(LIMITS).map(([name,ceiling])=>{const value=options[name]??ceiling;need(Number.isSafeInteger(value)&&value>0&&value<=ceiling,'invalid '+name+' bound');return[name,value]}))
 const interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid native request spacing')
 const owner=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,owner.signal]):owner.signal
 const timer=setTimeout(()=>owner.abort(new DOMException(SOURCE+' source deadline exceeded','TimeoutError')),limits.sourceTimeoutMs)
 const responses=[];let total=0,next=0,inFlight=false
 const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted()}
 return {check,close(){clearTimeout(timer);owner.abort()},stats:()=>({...limits,requestIntervalMs:interval,requests:responses.length,decodedBytes:total,originalResponses:structuredClone(responses)}),async read(url,{kind='html',phase='opening',allowRedirect=false,method='GET',headers={},body}={}){
  check();need(!inFlight&&responses.length<limits.maxRequests&&mimes[kind]&&allowedURL(url,kind,{method,headers,body}),'unbound, concurrent or excessive native read')
  inFlight=true
  try{
   if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
   check();next=performance.now()+interval
   const receipt={requestedUrl:url,phase,method,...(body===undefined?{}:{requestBodySHA256:digest(Buffer.from(body))}),bodyComplete:false};responses.push(receipt)
   const page=await boundedDeclaredPublicRead(url,{request:{method,...(body===undefined?{}:{body})},signal,timeoutMs:limits.requestTimeoutMs,overflowError:fail('native streaming byte ceiling exceeded'),fetchImpl:async(requested,init)=>{
    let response
    try{
     response=await(options.fetchImpl??fetch)(requested,{...init,headers:{...init.headers,...headers},credentials:'omit',cache:'no-store'});check();init.signal.throwIfAborted()
     need(response&&typeof response.headers?.get==='function'&&response.url===url&&response.redirected===false,'original native HTTP identity or redirect metadata changed')
     Object.assign(receipt,{status:response.status,url:response.url,redirected:response.redirected,headers:Object.fromEntries(response.headers)})
     if(!(allowRedirect&&response.status===302))await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},url,{context:SOURCE+' current read',signal:init.signal,callerSignal:options.signal??null})
     need(allowRedirect&&response.status===302||mimes[kind].test(response.headers.get('content-type')??''),'native MIME changed')
     let entity=0;const body=response.body
     return {status:response.status,url:response.url,headers:response.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){
      const reader=body.getReader()
      return {async read(){
       check();init.signal.throwIfAborted();const chunk=await reader.read();check();init.signal.throwIfAborted()
       if(!chunk.done){need(types.isUint8Array(chunk.value),'native stream is not bytes');const size=byteLength.call(chunk.value);entity+=size;total+=size;need(entity<=limits.maxEntityBytes&&total<=limits.maxTotalBytes,'native entity or aggregate byte ceiling exceeded')}
       return chunk
      },cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
     }}}
    }catch(error){ignore(()=>response?.body?.cancel(error));throw error}
   }})
   check();const bytes=Buffer.from(page.bodyBase64,'base64')
   Object.assign(receipt,{bodyComplete:true,bodyBase64:page.bodyBase64,bytes:bytes.length,sha256:digest(bytes)})
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);check()
   return {...page,text,sha256:receipt.sha256,redirected:false}
  }finally{inFlight=false}
 }}
}
