import{createHash}from'node:crypto'
import{setTimeout as delay}from'node:timers/promises'
import{requireNativeHttpResponse}from'../../scraper-support/shared/nativeHttpResponse.js'
import{disposeResponseBody,disposeResponseReader}from'../../scraper-support/shared/responseBodyDisposal.js'
import{isHttpAccessChallenge}from'../../scraper-support/utils/fetch.js'
export function currentTransport({label,allowedURL,fetchImpl:injectedFetch,signal:callerSignal,requestIntervalMs=1000,timeoutMs=180000,...legacyOptions}={}){
 callerSignal?.throwIfAborted()
 const fetchImpl=injectedFetch??globalThis.fetch
 if(!injectedFetch&&['fetchPage','fetchText','fetchJson','fetchProtocolTolerantText','fetchBrowserText','probeUrl'].some(key=>legacyOptions[key]!=null))throw Object.assign(Error('Unsupported legacy recruitment transport; original HTTP fetchImpl required'),{failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 if(typeof label!=='string'||typeof allowedURL!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000||!Number.isSafeInteger(requestIntervalMs)||requestIntervalMs<0||requestIntervalMs<1000&&fetchImpl===globalThis.fetch)throw Error('Current source transport limits invalid')
 const owner=new AbortController(),deadline=performance.now()+timeoutMs,timeout=new DOMException(label+' source deadline exceeded','TimeoutError'),timer=setTimeout(()=>owner.abort(timeout),timeoutMs),signal=callerSignal?AbortSignal.any([callerSignal,owner.signal]):owner.signal,receipts=[],prior=new Map();let requests=0,total=0
 const checkpoint=()=>{callerSignal?.throwIfAborted();if(performance.now()>=deadline&&!owner.signal.aborted)owner.abort(timeout);signal.throwIfAborted()}
 const race=async(pending,abortSignal)=>{let listener;try{return await Promise.race([pending,new Promise((_,reject)=>{listener=()=>reject(abortSignal.reason);abortSignal.addEventListener('abort',listener,{once:true});if(abortSignal.aborted)listener()})])}finally{if(listener)abortSignal.removeEventListener('abort',listener)}}
 return{receipts,checkpoint,close(){clearTimeout(timer);owner.abort()},async read(url,kind='html',expectedRedirect){
  checkpoint();if(!allowedURL(url)||++requests>96)throw Error(label+' request outside declared current source contract')
  const origin=new URL(url).origin,wait=requestIntervalMs-(performance.now()-(prior.get(origin)??-Infinity));if(wait>0)try{await delay(wait,undefined,{signal})}catch(error){checkpoint();throw error}checkpoint();prior.set(origin,performance.now())
  const requestOwner=new AbortController(),requestDeadline=performance.now()+25000,requestTimeout=new DOMException(label+' request deadline exceeded','TimeoutError'),requestTimer=setTimeout(()=>requestOwner.abort(requestTimeout),25000),requestSignal=AbortSignal.any([signal,requestOwner.signal]),requestedAt=new Date().toISOString()
  const requestCheck=()=>{checkpoint();if(performance.now()>=requestDeadline&&!requestOwner.signal.aborted)requestOwner.abort(requestTimeout);requestSignal.throwIfAborted()}
  let response,reader,complete=false
  const pending=Promise.resolve().then(()=>{requestCheck();return fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,headers:{Accept:kind==='json'?'application/json':kind==='js'?'application/javascript,text/javascript':'text/html,application/xhtml+xml'}})})
  pending.then(value=>{if(!response&&requestSignal.aborted)disposeResponseBody(value,{bestEffort:true}).catch(()=>{})},()=>{})
  try{response=await race(pending,requestSignal);callerSignal?.throwIfAborted()
   const redirect=expectedRedirect&&response.url===url&&response.status===expectedRedirect.status&&response.headers.get('location')===expectedRedirect.location&&!isHttpAccessChallenge(response)
   if(!redirect)await requireNativeHttpResponse(response,url,{context:label+' current native read',signal:requestSignal,callerSignal:callerSignal??null})
   requestCheck();const mime={html:/^(?:text\/html|application\/xhtml\+xml)(?:\s*;[^\r\n]*)?$/i,js:/^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:\s*;[^\r\n]*)?$/i,json:/^(?:application|text)\/(?:[a-z0-9][a-z0-9.+_-]*\+)?json(?:\s*;[^\r\n]*)?$/i}[kind]
   if(!redirect&&(!mime?.test(response.headers.get('content-type')??'')||!response.body))throw Error(label+' current response MIME/body changed')
   const chunks=[];let bytes=0;if(response.body){reader=response.body.getReader();for(;;){const p=await race(reader.read(),requestSignal);requestCheck();if(p.done){complete=true;break}bytes+=p.value.byteLength;total+=p.value.byteLength;if(bytes>4000000||total>32000000)throw Error(label+' source byte budget exceeded');chunks.push(Buffer.from(p.value))}}
   const buffer=Buffer.concat(chunks,bytes),text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);requestCheck();const receipt={url,method:'GET',status:response.status,finalURL:response.url,responseHeaders:Object.fromEntries(response.headers),location:response.headers.get('location'),bodyBytes:bytes,bodySHA256:createHash('sha256').update(buffer).digest('hex'),requestedAt,completedAt:new Date().toISOString()};const decoded=kind==='json'?{value:JSON.parse(text)}:{};requestCheck();receipts.push(receipt);return{...receipt,text,...decoded}
  }catch(error){let cleanup;if(reader&&!complete){const held=reader;reader=null;cleanup=disposeResponseReader(held,{bestEffort:true}).finally(()=>{try{held.releaseLock()}catch{}})}else if(!reader&&response&&!response.bodyUsed)cleanup=disposeResponseBody(response,{bestEffort:true})
   if(callerSignal?.aborted){cleanup?.catch(()=>{});callerSignal.throwIfAborted()}if(cleanup)await cleanup;callerSignal?.throwIfAborted();throw error
  }finally{clearTimeout(requestTimer);try{reader?.releaseLock()}catch{}}
 }}
}
