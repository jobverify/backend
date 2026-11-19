import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { boundedDeclaredPublicRead } from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import { requireNativeHttpResponse } from '../../scraper-support/shared/nativeHttpResponse.js'
import { disposeResponseBody } from '../../scraper-support/shared/responseBodyDisposal.js'
import { firstPartyFailure } from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'

const SOURCE='tanishasystems'
export const need=(ok,message)=>{if(!ok)throw firstPartyFailure(SOURCE,message)}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')

export function createCurrentReader(options,profile){
 const caller=options.signal,sourceMs=options.sourceTimeoutMs??120000,requestMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 caller?.throwIfAborted()
 need(!options.fetchJson&&!options.fetchPage&&!options.probeUrl&&!options.fetchBrowserText&&!options.fetchProtocolTolerantText,'unsupported metadata-free legacy callback')
 need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=180000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=15000&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(options.fetchImpl||interval>=500),'invalid native request bounds')
 const admitted=new Map(profile.documents.map(row=>[row.url,row])),owner=new AbortController(),started=performance.now(),expired=new DOMException(SOURCE+' source deadline exceeded','TimeoutError'),timer=setTimeout(()=>owner.abort(expired),sourceMs),signal=caller?AbortSignal.any([caller,owner.signal]):owner.signal,receipts=[]
 let next=0,total=0,inFlight=false
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=sourceMs&&!owner.signal.aborted)owner.abort(expired);signal.throwIfAborted()}
 return {check,close(){clearTimeout(timer);owner.abort()},stats:()=>({requests:receipts.length,decodedBytes:total,sourceTimeoutMs:sourceMs,requestTimeoutMs:requestMs,requestIntervalMs:interval,receipts:structuredClone(receipts)}),async read(url){
  check();need(admitted.has(url)&&!inFlight&&receipts.length<36,'unbound/concurrent/excessive native read');inFlight=true
  let receipt,observedHTTPError
  try{
   if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
   check();next=performance.now()+interval;receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
   const original=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestMs,overflowError:firstPartyFailure(SOURCE,'original native 16MiB byte ceiling exceeded'),fetchImpl:async(requested,init)=>{
    const response=await(options.fetchImpl??globalThis.fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
    try{
     caller?.throwIfAborted();Object.assign(receipt,{status:response.status,finalURL:response.url,headers:{'content-type':response.headers.get('content-type')}})
     try{await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},requested,{context:SOURCE+' current native read',signal:init.signal,callerSignal:caller??null})}catch(error){observedHTTPError=error;throw error}
     return response
    }catch(error){disposeResponseBody(response,{bestEffort:true}).catch(()=>{});throw error}
   }})
   check();const bytes=Buffer.from(original.bodyBase64,'base64'),expected=admitted.get(url);total+=bytes.length;Object.assign(receipt,{bodyComplete:true,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
   need(bytes.length<=2*1024*1024&&total<=8*1024*1024,'native entity/aggregate byte ceiling exceeded')
   const mime=original.headers['content-type']??'',pattern=expected.kind==='html'?/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i:expected.kind==='css'?/^text\/css(?:;|$)/i:/^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:;|$)/i
   need(pattern.test(mime),'native MIME changed')
   need(bytes.length===expected.bytes&&receipt.bodySHA256===expected.sha256,'whole current HTML/stylesheet/program profile changed')
   // The publisher declares UTF-8. Keep original bytes as well as the same
   // replacement characters a browser renders for its malformed punctuation.
   const text=new TextDecoder('utf8').decode(bytes);check()
   return {text,original,sha256:receipt.bodySHA256}
  }catch(error){caller?.throwIfAborted();if(observedHTTPError)throw observedHTTPError;check();throw error}
  finally{if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
 }}
}
