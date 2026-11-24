import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
import {HOME,need} from './nativeData20261121.js'
const MIME={html:/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i,json:/^application\/json(?:\s*;|$)/i,javascript:/^(?:(?:text|application)\/(?:x-)?javascript|text\/js)(?:\s*;|$)/i}
const valid=value=>{try{const u=new URL(value);return u.href===value&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hash}catch{return false}}
const sha=body=>createHash('sha256').update(body).digest('hex')
const timeout=kind=>new DOMException('Valutico '+kind+' deadline exceeded','TimeoutError')
async function settle(pending,ms=1000){
 let timer
 try{return await Promise.race([pending.then(value=>({ok:true,value}),error=>({ok:false,error})),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),ms)})])}finally{clearTimeout(timer)}
}
export function createValuticoReader(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'Original HTTP metadata is required')
 const sourceTimeoutMs=options.sourceTimeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=500,'Invalid bounded public read settings')
 const started=performance.now(),controller=new AbortController,signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const sourceTimer=setTimeout(()=>controller.abort(timeout('source')),sourceTimeoutMs),allowed=new Map([[HOME,'html']]),receipts=[],pending=new Set,disposals=new WeakMap
 let bytesTotal=0,nextStart=0,busy=false,closed=false,retainedHttpError=null,denialDisposal=null
 const dispose=(response,reader)=>{
  const owner=reader??response
  if(!owner||typeof owner!=='object')return Promise.resolve()
  if(!disposals.has(owner))disposals.set(owner,(reader?disposeResponseReader(reader,{bestEffort:true}):disposeResponseBody(response,{bestEffort:true})).catch(()=>{}))
  return disposals.get(owner)
 }
 const check=()=>{
  caller?.throwIfAborted()
  if(performance.now()-started>=sourceTimeoutMs&&!signal.aborted)controller.abort(timeout('source'))
  signal.throwIfAborted();need(!closed,'Source reader is closed')
 }
 async function raceOwned(operation,active){
  let listener
  const interrupted=new Promise(resolve=>{listener=()=>resolve({aborted:true});active.addEventListener('abort',listener,{once:true});if(active.aborted)listener()})
  const resultPromise=operation.then(value=>({ok:true,value}),error=>({ok:false,error}));resultPromise.catch(()=>{})
  pending.add(operation);operation.then(()=>pending.delete(operation),()=>pending.delete(operation))
  try{
   const first=await Promise.race([resultPromise,interrupted])
   if(!first.aborted){caller?.throwIfAborted();if(first.ok)return first.value;throw first.error}
   // The underlying fetch may ignore AbortSignal and return an unread entity
   // later. Keep that acquisition/cleanup owned within one bounded grace.
   const late=await settle(operation)
   caller?.throwIfAborted()
   if(late&&!late.ok&&late.error?.httpStatus)throw late.error
   throw active.reason
  }finally{active.removeEventListener('abort',listener)}
 }
 return{check,
  checkFinal(){caller?.throwIfAborted();if(performance.now()-started>=sourceTimeoutMs)throw timeout('source')},
  allow(url,kind){check();need(valid(url)&&MIME[kind]&&(!allowed.has(url)||allowed.get(url)===kind),'Invalid declared URL admission');allowed.set(url,kind)},
  async read(url,{allowFinal=u=>u===url,allowRedirect=()=>false}={}){
   check();const kind=allowed.get(url)
   need(kind&&!busy&&receipts.length<96,'Unbound, concurrent or excessive native request');busy=true
   let requestTimer,receipt,ownedResponse,bodyReader,finished=false
   const deadline=new AbortController,requestStarted=performance.now(),active=AbortSignal.any([signal,deadline.signal])
   const requestCheck=()=>{check();if(performance.now()-requestStarted>=requestTimeoutMs&&!deadline.signal.aborted)deadline.abort(timeout('request'));active.throwIfAborted()}
   try{
    if(nextStart>performance.now())await delay(nextStart-performance.now(),undefined,{signal})
    check();nextStart=performance.now()+interval
    receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),status:null,bodyComplete:false};receipts.push(receipt)
    requestTimer=setTimeout(()=>deadline.abort(timeout('request')),requestTimeoutMs)
    const operation=(async()=>{
     let page
     const init={method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',signal:active}
     if(options.fetchImpl)ownedResponse=await options.fetchImpl(url,init)
     else if(options.fetchPage){
      page=await options.fetchPage(url,{...init,format:kind})
      need(page?.headers&&Number.isInteger(page.status)&&typeof(page.finalUrl??page.url)==='string','Incomplete original native HTTP metadata')
      ownedResponse={status:page.status,url:page.finalUrl??page.url,headers:new Headers(page.headers),body:null}
     }else ownedResponse=await fetch(url,init)
     const response=ownedResponse,status=response.status,finalURL=response.url,headers=response.headers
     need(headers&&typeof headers.get==='function'&&Number.isInteger(status)&&typeof finalURL==='string','Incomplete original native HTTP metadata')
     Object.assign(receipt,{status,finalURL,headers:Object.fromEntries(headers)})
     if(caller?.aborted){await dispose(response);caller.throwIfAborted()}
     const redirect=[301,302,303,307,308].includes(status),location=headers.get('location')
     if(redirect&&finalURL===url&&typeof location==='string'&&allowRedirect(location)){
      requestCheck();await dispose(response);requestCheck()
      return{requestedURL:url,finalURL,status,headers:Object.fromEntries(headers),location,body:null,bodyRead:false}
     }
     // Known unavailable/challenge responses take priority over our own timer.
     // An allowed legacy-to-modern followed response still has its actual final
     // URL retained and validated separately, never normalized into employer proof.
     const permittedFinal=allowFinal(finalURL)
     try{await requireNativeHttpResponse({status,url:status===200&&permittedFinal?url:finalURL,headers,body:null},url,{context:'Valutico public native read',callerSignal:caller??null})}catch(error){
      if(Number.isInteger(error?.httpStatus)&&!retainedHttpError){retainedHttpError=error;denialDisposal=dispose(response)}
      await (denialDisposal??dispose(response));throw error
     }
     need(permittedFinal,'Unbound original native final URL')
     requestCheck();need(MIME[kind].test(headers.get('content-type')??''),'Original native '+kind+' MIME changed')
     if(page){
      need(page.bodyUnavailable!==true&&typeof page.body==='string','Unavailable original native entity')
      const data=Buffer.from(page.body)
      need(data.length<=4*1024*1024&&bytesTotal+data.length<=32*1024*1024,'Native byte budget exceeded')
      bytesTotal+=data.length;requestCheck();Object.assign(receipt,{bytes:data.length,sha256:sha(data),bodyComplete:true})
      finished=true;return{requestedURL:url,finalURL,status,headers:Object.fromEntries(headers),body:page.body,bytes:data.length,sha256:receipt.sha256}
     }
     const chunks=[];let length=0
     if(response.body){
      need(typeof response.body.getReader==='function','Native body has no bounded stream')
      bodyReader=response.body.getReader()
      let onAbort
      try{
       const interrupted=new Promise((_,reject)=>{onAbort=()=>{dispose(response,bodyReader);reject(active.reason)};active.addEventListener('abort',onAbort,{once:true});if(active.aborted)onAbort()});interrupted.catch(()=>{})
       while(true){
        requestCheck();const part=await Promise.race([bodyReader.read(),interrupted]);requestCheck()
        if(part.done)break
        need(part.value instanceof Uint8Array,'Non-byte native stream chunk');length+=part.value.byteLength
        need(length<=4*1024*1024&&bytesTotal+length<=32*1024*1024,'Native byte budget exceeded')
        chunks.push(Buffer.from(part.value))
       }
      }catch(error){await dispose(response,bodyReader);throw error}
      finally{if(onAbort)active.removeEventListener('abort',onAbort);try{bodyReader.releaseLock()}catch{}}
     }
     const data=Buffer.concat(chunks),body=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(data)
     requestCheck();bytesTotal+=data.length
     Object.assign(receipt,{bytes:data.length,sha256:sha(data),bodyComplete:true});finished=true
     return{requestedURL:url,finalURL,status,headers:Object.fromEntries(headers),body,bytes:data.length,sha256:receipt.sha256}
    })().catch(async error=>{if(ownedResponse&&!finished)await dispose(ownedResponse,bodyReader);caller?.throwIfAborted();throw error})
    return await raceOwned(operation,active)
   }catch(error){caller?.throwIfAborted();if(Number.isInteger(error?.httpStatus))throw error;signal.throwIfAborted();deadline.signal.throwIfAborted();throw error}
   finally{clearTimeout(requestTimer);if(receipt)receipt.completedAt=new Date().toISOString();busy=false}
  },
  stats:()=>({requests:receipts.length,decodedBytes:bytesTotal,receipts:structuredClone(receipts),maxRequests:96,maxEntityBytes:4*1024*1024,maxAggregateBytes:32*1024*1024,requestTimeoutMs,sourceTimeoutMs,requestIntervalMs:interval,cleanupGraceMs:1000}),
  async close(){
   if(!closed){closed=true;clearTimeout(sourceTimer);controller.abort(timeout('reader closed'))}
   if(pending.size)await settle(Promise.allSettled([...pending]))
   // Metadata may arrive after read()'s grace, while final owned close is
   // settling. Keep that known denial and finish its bounded disposal.
   if(denialDisposal)await denialDisposal
   caller?.throwIfAborted();return retainedHttpError
  }
 }
}
