import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
export const need=(ok,message)=>{if(!ok)throw firstPartyFailure('ekasoftware',message)}
export const sha=b=>createHash('sha256').update(b).digest('hex')
export function createEkaReader(options,admitted){
 const caller=options.signal,sourceMs=options.sourceTimeoutMs??180000,requestMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 caller?.throwIfAborted();need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=180000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=15000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid native request bounds')
 const allowed=new Map(admitted),owner=new AbortController(),started=performance.now(),expired=new DOMException('Eka native source deadline exceeded','TimeoutError'),timer=setTimeout(()=>owner.abort(expired),sourceMs),signal=caller?AbortSignal.any([caller,owner.signal]):owner.signal,receipts=[]
 let next=0,total=0,inFlight=false
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=sourceMs&&!owner.signal.aborted)owner.abort(expired);signal.throwIfAborted()}
 return {check,close(){clearTimeout(timer);owner.abort()},stats:()=>({requests:receipts.length,decodedBytes:total,sourceTimeoutMs:sourceMs,requestTimeoutMs:requestMs,requestIntervalMs:interval,receipts:structuredClone(receipts)}),allowOwnRole(id){check();need(Number.isSafeInteger(id)&&id>0,'invalid own-role native ID');allowed.set('https://careers.quoreka.com/hire/widgets/jobs/'+id+'.json','json')},async read(url){
  check();need(allowed.has(url)&&!inFlight&&receipts.length<240,'unbound/concurrent/excessive native read');inFlight=true
  let receipt,observedHTTPError
  try{
   if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
   check();next=performance.now()+interval;receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
   const original=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestMs,overflowError:firstPartyFailure('ekasoftware','original native16MiB byte ceiling exceeded'),fetchImpl:async(requested,init)=>{
    const response=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    try{
     caller?.throwIfAborted();Object.assign(receipt,{status:response.status,finalURL:response.url,headers:Object.fromEntries(response.headers)})
     try{await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},requested,{context:'Eka current native read',signal:init.signal,callerSignal:caller??null})}catch(error){observedHTTPError=error;throw error}
     return response
    }catch(error){disposeResponseBody(response,{bestEffort:true}).catch(()=>{});throw error}
   }})
   check();const bytes=Buffer.from(original.bodyBase64,'base64');total+=bytes.length;Object.assign(receipt,{bodyComplete:true,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
   need(total<=32*1024*1024,'aggregate native32MiB byte ceiling exceeded')
   const kind=allowed.get(url),mime=original.headers['content-type']??'',pattern={html:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i,json:/^(?:application|text)\/(?:[\w.+-]*\+)?json(?:;|$)/i,javascript:/^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:;|$)/i,css:/^text\/css(?:;|$)/i,loader:/^text\/plain(?:;|$)/i}[kind]
   need(pattern?.test(mime),'original native MIME changed');const text=new TextDecoder('utf8',{fatal:true}).decode(bytes);check();return {text,sha256:receipt.bodySHA256}
  }catch(error){caller?.throwIfAborted();if(observedHTTPError)throw observedHTTPError;check();throw error}
  finally{if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
 }}
}
