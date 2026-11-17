import{createHash}from'node:crypto'
import{setTimeout as delay}from'node:timers/promises'
import{requireNativeHttpResponse}from'../../scraper-support/shared/nativeHttpResponse.js'
import{disposeResponseBody,disposeResponseReader}from'../../scraper-support/shared/responseBodyDisposal.js'
const urls=new Set(['https://atain.com/','https://atain.com/careers/','https://atain.com/join-the-squad/'])
export function currentIgtTransport({fetchImpl=globalThis.fetch,signal:callerSignal,requestIntervalMs=1000,timeoutMs=60000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isSafeInteger(requestIntervalMs)||requestIntervalMs<0||requestIntervalMs<1000&&fetchImpl===globalThis.fetch)throw Error('IGT current transport limits invalid')
 const owner=new AbortController(),deadline=performance.now()+timeoutMs,timeout=new DOMException('IGT Solutions current source deadline exceeded','TimeoutError'),timer=setTimeout(()=>owner.abort(timeout),timeoutMs),signal=callerSignal?AbortSignal.any([callerSignal,owner.signal]):owner.signal,receipts=[]
 let count=0,total=0,prior=0
 const checkpoint=()=>{callerSignal?.throwIfAborted();if(performance.now()>=deadline&&!owner.signal.aborted)owner.abort(timeout);signal.throwIfAborted()}
 const race=async(pending,requestSignal)=>{let listener;try{return await Promise.race([pending,new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()})])}finally{if(listener)requestSignal.removeEventListener('abort',listener)}}
 return{receipts,checkpoint,close(){clearTimeout(timer);owner.abort()},async read(url){
  checkpoint();if(!urls.has(url)||++count>8)throw Error('IGT request outside current declared source contract')
  const wait=requestIntervalMs-(performance.now()-prior);if(prior&&wait>0)try{await delay(wait,undefined,{signal})}catch(e){checkpoint();throw e}checkpoint();prior=performance.now()
  const requestOwner=new AbortController(),requestDeadline=performance.now()+15000,requestTimeout=new DOMException('IGT current request deadline exceeded','TimeoutError'),requestTimer=setTimeout(()=>requestOwner.abort(requestTimeout),15000),requestSignal=AbortSignal.any([signal,requestOwner.signal]),requestedAt=new Date().toISOString()
  const requestCheck=()=>{checkpoint();if(performance.now()>=requestDeadline&&!requestOwner.signal.aborted)requestOwner.abort(requestTimeout);requestSignal.throwIfAborted()}
  let response,reader,complete=false
  const pending=Promise.resolve().then(()=>{requestCheck();return fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,headers:{Accept:'text/html,application/xhtml+xml'}})})
  pending.then(value=>{if(!response&&requestSignal.aborted)disposeResponseBody(value,{bestEffort:true}).catch(()=>{})},()=>{})
  try{response=await race(pending,requestSignal);callerSignal?.throwIfAborted();await requireNativeHttpResponse(response,url,{context:'IGT current native acquisition',signal:requestSignal,callerSignal:callerSignal??null});requestCheck()
   if(!/^(?:text\/html|application\/xhtml\+xml)[ \t]*(?:;|$)/i.test(response.headers.get('content-type')??'')||!response.body)throw Error('IGT current response MIME/body changed')
   reader=response.body.getReader();const chunks=[];let bytes=0
   for(;;){const p=await race(reader.read(),requestSignal);requestCheck();if(p.done){complete=true;break}bytes+=p.value.byteLength;total+=p.value.byteLength;if(bytes>1000000||total>8000000)throw Error('IGT current byte budget exceeded');chunks.push(Buffer.from(p.value))}
   const buffer=Buffer.concat(chunks,bytes),text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);requestCheck();const receipt={url,method:'GET',status:response.status,bodyBytes:bytes,bodySHA256:createHash('sha256').update(buffer).digest('hex'),requestedAt,completedAt:new Date().toISOString()};receipts.push(receipt);return{...receipt,text}
  }catch(error){let cleanup;if(reader&&!complete){const held=reader;reader=null;cleanup=disposeResponseReader(held,{bestEffort:true}).finally(()=>{try{held.releaseLock()}catch{}})}else if(!reader&&response&&!response.bodyUsed)cleanup=disposeResponseBody(response,{bestEffort:true})
   if(callerSignal?.aborted){cleanup?.catch(()=>{});callerSignal.throwIfAborted()}if(cleanup)await cleanup;callerSignal?.throwIfAborted();throw error
  }finally{clearTimeout(requestTimer);try{reader?.releaseLock()}catch{}}
 }}
}
