import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'

const SOURCE='dsmfirmenich'
export const CAREERS='https://careers.dsm-firmenich.com/en/careers.html',BOARD='https://jobs.dsm-firmenich.com/careers',ORIGIN='https://jobs.dsm-firmenich.com'
const mimes={html:/^text\/html(?:;|$)/i,javascript:/^(?:application|text)\/(?:x-)?javascript(?:;|$)/i,json:/^application\/json(?:;|$)/i}
const typedArray=Object.getPrototypeOf(Uint8Array.prototype),get=name=>Object.getOwnPropertyDescriptor(typedArray,name).get,byteLength=get('byteLength'),byteOffset=get('byteOffset'),arrayBuffer=get('buffer')
const ignore=start=>{try{Promise.resolve(start()).catch(()=>{})}catch{/* Cleanup cannot replace the primary outcome. */}},fail=message=>firstPartyFailure(SOURCE,message)
export function createDsmNativeReader(options={}){
 options.signal?.throwIfAborted()
 if(options.fetchText||options.fetchJson||options.fetchPage)throw fail('Original HTTP metadata required; body-only callbacks cannot certify current native input')
 const sourceMs=options.sourceTimeoutMs??90000,readMs=options.requestTimeoutMs??15000
 if(!Number.isSafeInteger(sourceMs)||sourceMs<1||sourceMs>180000||!Number.isSafeInteger(readMs)||readMs<1||readMs>15000)throw RangeError('Invalid DSM native source/read deadline')
 const interval=options.requestIntervalMs??500
 if(!Number.isSafeInteger(interval)||interval<0||interval>5000||(interval<500&&!options.fetchImpl))throw RangeError('Invalid DSM native request pacing')
 const sourceStarted=performance.now(),owner=new AbortController(),sourceTimer=setTimeout(()=>owner.abort(new DOMException('DSM source deadline exceeded','TimeoutError')),sourceMs),signal=options.signal?AbortSignal.any([options.signal,owner.signal]):owner.signal
 const permitted=new Map([[CAREERS,'html'],[BOARD,'html']]),receipts=[],deniedHosts=new Set();let next=0,total=0,inFlight=false
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-sourceStarted>=sourceMs&&!owner.signal.aborted)owner.abort(new DOMException('DSM source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 return {check,
  allow(url,kind){
   check();const u=new URL(url)
   const programme=kind==='javascript'&&/^\/gen\/js\/(?:pcsxPwa|12480|single-position-page)\.[a-f0-9]+\.js$/.test(u.pathname)&&!u.search
   const role=kind==='html'&&/^\/careers\/job\/[1-9]\d+$/.test(u.pathname)&&!u.search
   const search=kind==='json'&&u.pathname==='/api/pcsx/search'&&u.search==='?domain=dsm.com&query=&location=India&start=0&'
   const detail=kind==='json'&&u.pathname==='/api/pcsx/position_details'&&/^\?position_id=[1-9]\d+&domain=dsm.com&hl=en$/.test(u.search)
   if(u.origin!==ORIGIN||u.hash||u.username||u.password||!(programme||role||search||detail))throw fail('Unbound publisher-declared native dependency')
   permitted.set(url,kind)
  },
  async read(url){
   check();if(!permitted.has(url)||inFlight||receipts.length>=64||deniedHosts.has(new URL(url).hostname))throw fail('Unbound, concurrent, denied-host or excessive native request')
   inFlight=true;let receipt,timer,listener,response,reader,observedHTTPError,requestSignal,requestCheck
   const canceled=new WeakSet(),released=new WeakSet()
   const release=value=>{if(!value||released.has(value))return;released.add(value);ignore(()=>value.releaseLock())}
   const cancelReader=(value,reason)=>{
    if(!value||canceled.has(value))return;canceled.add(value)
    // Initiate cancellation before releasing the native lock. Its settlement
    // remains bounded independently, including a publisher that never settles.
    let cleanup;try{cleanup=value.cancel(reason)}catch{/* Retain the original read/caller reason. */}
    ignore(()=>disposeResponseReader({cancel:()=>cleanup},{bestEffort:true}));release(value)
   }
   const cancelResponse=(value,reason)=>{const body=value?.body;if(!body||canceled.has(body))return;canceled.add(body);ignore(()=>disposeResponseBody(value,{reason,bestEffort:true}))}
   const method='GET'
   try{
    if(next>performance.now())try{await delay(next-performance.now(),undefined,{signal})}catch(error){check();throw error}
    check();next=performance.now()+interval
    receipt={requestedUrl:url,method,requestBodyPresent:false,requestedAt:new Date().toISOString(),status:null,bodyComplete:false};receipts.push(receipt)
    const started=performance.now(),deadline=new AbortController(),expired=new DOMException('DSM request deadline exceeded','TimeoutError')
    requestSignal=AbortSignal.any([signal,deadline.signal]);timer=setTimeout(()=>deadline.abort(expired),readMs)
    requestCheck=()=>{check();if(performance.now()-started>=readMs&&!deadline.signal.aborted)deadline.abort(expired);requestSignal.throwIfAborted()}
    const wait=(operation,disposeLate)=>new Promise((resolve,reject)=>{
     let settled=false,failure
     const detach=()=>requestSignal.removeEventListener('abort',listener)
     const stop=reason=>{if(!settled){settled=true;failure=reason;detach();reject(reason)}}
     listener=()=>stop(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true})
     try{requestCheck()}catch(error){stop(error);return}
     Promise.resolve().then(()=>{requestCheck();return operation()}).then(value=>{
      if(settled){if(disposeLate)ignore(()=>disposeLate(value,failure));return}
      try{requestCheck()}catch(error){stop(error);if(disposeLate)ignore(()=>disposeLate(value,error));return}
      settled=true;detach();resolve(value)
     },error=>{if(settled)return;try{requestCheck()}catch(expired){error=expired}stop(error)})
    })
    response=await wait(async()=>{
     const acquired=await(options.fetchImpl??globalThis.fetch)(url,{method,redirect:'manual',signal:requestSignal,credentials:'omit',cache:'no-store',headers:{Accept:'*/*','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'}})
     try{
      options.signal?.throwIfAborted()
      Object.assign(receipt,{status:acquired.status,finalUrl:acquired.url,headers:Object.fromEntries([...acquired.headers].map(([k,v])=>[k,/set-cookie|csrf|xsrf|authorization/i.test(k)?'[REDACTED ISSUED COOKIE/CSRF METADATA]':v]))})
      try{await requireNativeHttpResponse({status:acquired.status,url:acquired.url,headers:acquired.headers,body:null},url,{context:'DSM current native read',signal:requestSignal,callerSignal:options.signal??null})}
      catch(error){observedHTTPError=error;if(error.failureKind==='blocked_or_access_denied')deniedHosts.add(new URL(url).hostname);cancelResponse(acquired,error);throw error}
      return acquired
     }catch(error){if(!observedHTTPError)cancelResponse(acquired,error);throw error}
    },cancelResponse)
    requestCheck();const chunks=[];let size=0
    if(response.body!==null){
     reader=await wait(()=>response.body.getReader(),cancelReader)
     for(;;){const {done,value}=await wait(()=>reader.read());if(done)break
      if(!types.isUint8Array(value))throw TypeError('Original DSM native chunk must be Uint8Array')
      const length=byteLength.call(value);if(length>16*1024*1024-size)throw fail('Original native16MiB response ceiling exceeded')
      requestCheck();chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value),byteOffset.call(value),length)));size+=length
     }
    }
    requestCheck();const bytes=Buffer.concat(chunks,size);total+=bytes.length;Object.assign(receipt,{bodyComplete:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
    if(total>32*1024*1024)throw fail('Aggregate native32MiB byte ceiling exceeded')
    if(!mimes[permitted.get(url)].test(receipt.headers['content-type']??''))throw fail('Original native MIME changed')
    const body=new TextDecoder('utf8',{fatal:true}).decode(bytes);requestCheck();return {body,sha256:receipt.sha256}
   }catch(error){
    const primary=options.signal?.aborted?options.signal.reason:observedHTTPError??error
    if(reader)cancelReader(reader,primary);else if(!observedHTTPError)cancelResponse(response,primary)
    options.signal?.throwIfAborted();if(observedHTTPError)throw observedHTTPError;requestCheck?.();throw error
   }
   finally{if(timer)clearTimeout(timer);if(listener)requestSignal?.removeEventListener('abort',listener);release(reader);if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
  },
  stats:()=>({requests:receipts.length,decodedBytes:total,receipts:structuredClone(receipts),requestTimeoutMs:readMs,sourceTimeoutMs:sourceMs,nativeRequestIntervalMs:interval}),
  close(){clearTimeout(sourceTimer);owner.abort()},
 }
}
