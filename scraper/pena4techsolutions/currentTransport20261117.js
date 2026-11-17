import {setTimeout as delay} from 'node:timers/promises'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
import {JOBS,SHORT,PORTAL,GATEWAY,LIST,LABELS,PROGRAM,need,sha} from './currentContract20261117.js'

// Only the validated source contract supplies these paths and read-only bodies.
// Known HTTP status is admitted before reading an entity or waiting for disposal.
export function createPena4Reader(options){
 const caller=options.signal,fetchImpl=options.fetchImpl??globalThis.fetch,sourceTimeoutMs=options.sourceTimeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??25000,interval=options.requestIntervalMs??500
 caller?.throwIfAborted()
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=300000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=25000,'invalid native deadline')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid native pacing')
 const controller=new AbortController(),sourceStarted=performance.now(),sourceReason=new DOMException('Pena4 source deadline exceeded','TimeoutError'),timer=setTimeout(()=>controller.abort(sourceReason),sourceTimeoutMs),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[]
 let nextStart=0,totalBytes=0,inFlight=false
 const race=async(pending,requestSignal,late)=>{
  let listener,settled=false
  try{return await Promise.race([Promise.resolve(pending).then(value=>{if(settled){late?.(value);requestSignal.throwIfAborted()}return value}),new Promise((_,reject)=>{listener=()=>{settled=true;reject(requestSignal.reason)};requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()})])}
  finally{if(listener)requestSignal.removeEventListener('abort',listener)}
 }
 const background=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
 const check=()=>{caller?.throwIfAborted();if(performance.now()-sourceStarted>=sourceTimeoutMs&&!controller.signal.aborted)controller.abort(sourceReason);signal.throwIfAborted()}
 return {check,close(){clearTimeout(timer);controller.abort()},stats:()=>({requests:receipts.length,decodedBytes:totalBytes,requestTimeoutMs,sourceTimeoutMs,requestIntervalMs:interval,receipts:structuredClone(receipts)}),async read(url,{kind='html',method='GET',headers={},body}={}){
  check();let target;try{target=new URL(url)}catch{need(false,'invalid native URL')}
  const exact=target.href===url&&target.protocol==='https:'&&!target.username&&!target.password&&!target.hash
  const allowed=exact&&(url===JOBS||url===SHORT||PROGRAM.some(p=>url===PORTAL+p.path)||target.origin===PORTAL&&target.pathname==='/career-portal'||url===LIST||url===LABELS||target.origin===GATEWAY&&/^\/api\/external\/public\/referral\/JobOpening\/Request\/Details\/[^/]+\/[^/]+\/[^/]+$/.test(target.pathname)&&!target.search)
  need(allowed&&!inFlight&&receipts.length<600,'undeclared, concurrent or excessive native read')
  need(method==='GET'&&body===undefined||method==='POST'&&url===LIST&&typeof body==='string'&&Buffer.byteLength(body)<=1024,'undeclared native operation')
  inFlight=true;let requestTimer,response,reader,complete=false,observedHTTPError,receipt
  try{
   if(nextStart>Date.now())try{await delay(nextStart-Date.now(),undefined,{signal})}catch(error){check();throw error}
   check();nextStart=Date.now()+interval
   const local=new AbortController(),requestStarted=performance.now(),requestReason=new DOMException('Pena4 request deadline exceeded','TimeoutError'),requestSignal=AbortSignal.any([signal,local.signal]);requestTimer=setTimeout(()=>local.abort(requestReason),requestTimeoutMs)
   const requestCheck=()=>{check();if(performance.now()-requestStarted>=requestTimeoutMs&&!local.signal.aborted)local.abort(requestReason);requestSignal.throwIfAborted()}
   receipt={requestedURL:url,method,...(body===undefined?{}:{requestBodyBytes:Buffer.byteLength(body),requestBodySHA256:sha(body)}),requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
   const pending=Promise.resolve().then(()=>{requestSignal.throwIfAborted();return fetchImpl(url,{method,headers:{Accept:kind==='json'?'application/json':kind==='js'?'application/javascript':'text/html,application/xhtml+xml',...headers},...(body===undefined?{}:{body}),credentials:'omit',cache:'no-store',redirect:'manual',signal:requestSignal})})
   response=await race(pending,requestSignal,value=>background(()=>disposeResponseBody(value,{bestEffort:true})))
   caller?.throwIfAborted();Object.assign(receipt,{status:response.status,finalURL:response.url,headers:Object.fromEntries(response.headers)})
   const redirect=url===SHORT&&response.status===302&&response.url===url&&!isHttpAccessChallenge(response)
   if(!redirect)try{await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},url,{context:'Pena4 native read',signal:requestSignal,callerSignal:caller??null})}catch(error){observedHTTPError=error;throw error}
   requestCheck()
   const mime=response.headers.get('content-type')??'',pattern={json:/^(?:application|text)\/(?:[\w.+-]*\+)?json(?:;|$)/i,html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,js:/^(?:text|application)\/(?:x-)?(?:java|ecma)script(?:;|$)/i}[kind]
   need(redirect||pattern?.test(mime),'native '+kind+' MIME changed');need(response.body||redirect,'native response body unavailable')
   reader=response.body?.getReader();const chunks=[];let bytes=0
   for(;reader;){const part=await race(reader.read(),requestSignal);requestCheck();if(part.done){complete=true;break}
    need(part.value instanceof Uint8Array,'native byte chunk malformed');bytes+=part.value.byteLength;totalBytes+=part.value.byteLength
    need(bytes<=4*1024*1024&&totalBytes<=64*1024*1024,'native byte bound exceeded');chunks.push(Buffer.from(part.value))}
   const data=Buffer.concat(chunks,bytes),text=new TextDecoder('utf8',{fatal:true}).decode(data);Object.assign(receipt,{bodyComplete:true,bodyBytes:bytes,bodySHA256:sha(data)})
   requestCheck();return {text,bodySHA256:receipt.bodySHA256,...(redirect?{location:response.headers.get('location')}:{})}
  }catch(error){
   let cleanup
   if(reader&&!complete){const owned=reader;reader=null;cleanup=disposeResponseReader(owned,{bestEffort:true}).finally(()=>{try{owned.releaseLock()}catch{}})}
   else if(response&&!response.bodyUsed)cleanup=disposeResponseBody(response,{bestEffort:true})
   if(caller?.aborted||observedHTTPError){cleanup?.catch(()=>{});caller?.throwIfAborted();throw observedHTTPError}
   if(cleanup)await cleanup
   caller?.throwIfAborted();check();throw error
  }finally{clearTimeout(requestTimer);try{reader?.releaseLock()}catch{}if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
 }}
}
