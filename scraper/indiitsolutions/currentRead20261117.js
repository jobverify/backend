import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody} from '../../scraper-support/shared/responseBodyDisposal.js'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
const SOURCE='indiitsolutions'
export const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
export const sha=b=>createHash('sha256').update(b).digest('hex')
export function createCurrentReader(options,admitted,{redirects={},maxReads=100,roleURL=()=>false}={}){
 const caller=options.signal,sourceMs=options.sourceTimeoutMs??120000,requestMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 caller?.throwIfAborted();need(!options.fetchPage&&!options.probeUrl&&!options.fetchText&&!options.fetchBrowserText&&!options.fetchProtocolTolerantText,'unsupported metadata-free legacy callback')
 need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=180000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=15000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid native request bounds')
 const allowed=new Map(admitted),owner=new AbortController(),started=performance.now(),expired=new DOMException(SOURCE+' source deadline exceeded','TimeoutError'),timer=setTimeout(()=>owner.abort(expired),sourceMs),signal=caller?AbortSignal.any([caller,owner.signal]):owner.signal,receipts=[]
 let next=0,total=0,inFlight=false
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=sourceMs&&!owner.signal.aborted)owner.abort(expired);signal.throwIfAborted()}
 return {check,allowNativeDetail(url){check();need(roleURL(url),'unbound native detail URL');allowed.set(url,'html')},close(){clearTimeout(timer);owner.abort()},stats:()=>({requests:receipts.length,decodedBytes:total,sourceTimeoutMs:sourceMs,requestTimeoutMs:requestMs,requestIntervalMs:interval,receipts:structuredClone(receipts)}),async read(url){
  check();need(allowed.has(url)&&!inFlight&&receipts.length<maxReads,'unbound/concurrent/excessive native read');inFlight=true
  let receipt,observedHTTPError
  try{
   if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
   check();next=performance.now()+interval;receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
   const original=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestMs,overflowError:firstPartyFailure(SOURCE,'original native16MiB byte ceiling exceeded'),fetchImpl:async(requested,init)=>{
    const response=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    try{
     caller?.throwIfAborted();Object.assign(receipt,{status:response.status,finalURL:response.url,headers:Object.fromEntries(response.headers)})
     if(redirects[requested]&&response.status===redirects[requested].status&&!isHttpAccessChallenge(response)){
      need(response.url===requested&&response.headers.get('location')===redirects[requested].target,'exact own native redirect changed')
     }else try{await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},requested,{context:SOURCE+' current native read',signal:init.signal,callerSignal:caller??null})}catch(error){observedHTTPError=error;throw error}
     return response
    }catch(error){disposeResponseBody(response,{bestEffort:true}).catch(()=>{});throw error}
   }})
   check();const bytes=Buffer.from(original.bodyBase64,'base64');total+=bytes.length;Object.assign(receipt,{bodyComplete:true,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
   need(total<=32*1024*1024,'aggregate native32MiB byte ceiling exceeded')
   const kind=allowed.get(url),mime=original.headers['content-type']??'';if(kind==='binary'){need(/^application\/javascript(?:;|$)/i.test(mime),'original declared native binary MIME changed');return {bytes,sha256:receipt.bodySHA256,status:original.status,location:original.headers.location??null,text:null}}const pattern=kind==='html'?/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i:/^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:;|$)/i
   need(pattern.test(mime),'original native MIME changed');const text=new TextDecoder('utf8',{fatal:true}).decode(bytes);check();return {text,sha256:receipt.bodySHA256,status:original.status,location:original.headers.location??null}
  }catch(error){caller?.throwIfAborted();if(observedHTTPError)throw observedHTTPError;check();throw error}
  finally{if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
 }}
}

