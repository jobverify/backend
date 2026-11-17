import {createHash} from 'node:crypto'
import {isHttpAccessChallenge} from '../../scraper-support/utils/fetch.js'
import {setTimeout as delay} from 'node:timers/promises'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'

export function currentAmeyoTransport({allowedURL,fetchImpl=globalThis.fetch,signal:callerSignal,requestIntervalMs=1000,timeoutMs=180000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000||!Number.isSafeInteger(requestIntervalMs)||requestIntervalMs<0
  ||requestIntervalMs<1000&&fetchImpl===globalThis.fetch)throw Error('Ameyo current invalid native transport limits')
 const sourceStarted=performance.now(),sourceReason=Error('Ameyo current source deadline exceeded'),owner=new AbortController(),timer=setTimeout(()=>owner.abort(sourceReason),timeoutMs)
 const signal=callerSignal?AbortSignal.any([callerSignal,owner.signal]):owner.signal,prior=new Map(),receipts=[]
 const check=()=>{callerSignal?.throwIfAborted();if(performance.now()-sourceStarted>=timeoutMs&&!owner.signal.aborted)owner.abort(sourceReason);signal.throwIfAborted()}
 let count=0,total=0
 const race=async(pending,requestSignal)=>{
  let listener
  try{return await Promise.race([pending,new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason)
   requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()})])}
  finally{if(listener)requestSignal.removeEventListener('abort',listener)}
 }
 return {signal,receipts,close(){clearTimeout(timer);owner.abort()},async read(url,kind='html'){
  check()
  if(!allowedURL(url)||++count>80)throw Error('Ameyo current request outside declared native contract')
  const wait=requestIntervalMs-(Date.now()-(prior.get(new URL(url).origin)||0))
  if(wait>0)try{await delay(wait,undefined,{signal})}catch(error){callerSignal?.throwIfAborted();signal.throwIfAborted();throw error}
  check();prior.set(new URL(url).origin,Date.now())
  const requestStarted=performance.now(),elapsed=new AbortController(),requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000),elapsed.signal]),requestedAt=new Date().toISOString()
  const requestCheck=()=>{check();if(performance.now()-requestStarted>=20000&&!elapsed.signal.aborted)elapsed.abort(new DOMException('Ameyo current request deadline exceeded','TimeoutError'));requestSignal.throwIfAborted()}
  let response,reader,complete=false
  const pending=Promise.resolve().then(()=>fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,
   headers:{Accept:kind==='json'?'application/json':kind==='js'?'application/javascript':kind==='css'?'text/css':'text/html,application/xhtml+xml'}}))
  pending.then(value=>{if(!response&&requestSignal.aborted)disposeResponseBody(value,{bestEffort:true}).catch(()=>{})},()=>{})
  try{
   response=await race(pending,requestSignal)
   const knownRedirect=url==='https://www.ameyo.com/'&&response.status===301&&response.url===url&&response.headers.get('location')==='https://exotel.com/ameyo-contact-center-by-exotel/'&&!isHttpAccessChallenge(response)
   if(!knownRedirect)await requireNativeHttpResponse(response,url,{context:'Ameyo current native read',signal:requestSignal,callerSignal:callerSignal??null})
   requestCheck()
   const mime=response.headers.get('content-type')||'',pattern={json:/^(?:application|text)\/(?:[\w.+-]*\+)?json[ \t]*(?:;|$)/i,
    html:/^(?:text\/html|application\/xhtml\+xml)[ \t]*(?:;|$)/i,js:/^(?:application|text)\/(?:x-)?(?:java|ecma)script[ \t]*(?:;|$)/i,css:/^text\/css[ \t]*(?:;|$)/i}[kind]
   if(!pattern?.test(mime)||!response.body)throw Error('Ameyo current native MIME/body contract changed')
   reader=response.body.getReader();const chunks=[];let bytes=0
   for(;;){requestCheck();const part=await race(reader.read(),requestSignal);requestCheck();if(part.done){complete=true;break}
    bytes+=part.value.byteLength;total+=part.value.byteLength;if(bytes>2000000||total>16000000)throw Error('Ameyo current native byte bound exceeded');chunks.push(Buffer.from(part.value))}
   const body=Buffer.concat(chunks,bytes),text=new TextDecoder('utf-8',{fatal:true}).decode(body),receipt={url,status:response.status,
    bodyBytes:bytes,bodySHA256:createHash('sha256').update(body).digest('hex'),requestedAt,completedAt:new Date().toISOString()}
   const value=kind==='json'?{value:JSON.parse(text)}:{};requestCheck()
   receipts.push(receipt)
   return {...receipt,text,...value}
  }catch(error){
   let cleanup
   if(reader&&!complete){
    const ownedReader=reader;reader=null
    cleanup=disposeResponseReader(ownedReader,{bestEffort:true}).finally(()=>{try{ownedReader.releaseLock()}catch{}})
   }else if(!reader&&response&&!response.bodyUsed)cleanup=disposeResponseBody(response,{bestEffort:true})
   if(callerSignal?.aborted){cleanup?.catch(()=>{});callerSignal.throwIfAborted()}
   if(cleanup)await cleanup
   callerSignal?.throwIfAborted()
   throw error
  }finally{try{reader?.releaseLock()}catch{}}
 }}
}
