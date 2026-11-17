import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'

export function currentRapid7Transport({allowedURL,fetchImpl=globalThis.fetch,signal:callerSignal,requestIntervalMs=1000,timeoutMs=180000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000||!Number.isSafeInteger(requestIntervalMs)||requestIntervalMs<0
  ||requestIntervalMs<1000&&fetchImpl===globalThis.fetch)throw Error('Rapid7 current invalid native transport limits')
 const owner=new AbortController(),timer=setTimeout(()=>owner.abort(Error('Rapid7 current source deadline exceeded')),timeoutMs)
 const signal=callerSignal?AbortSignal.any([callerSignal,owner.signal]):owner.signal,prior=new Map(),receipts=[]
 let count=0,total=0
 const race=async(pending,requestSignal)=>{
  let listener
  try{return await Promise.race([pending,new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason)
   requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()})])}
  finally{if(listener)requestSignal.removeEventListener('abort',listener)}
 }
 return {signal,receipts,close(){clearTimeout(timer);owner.abort()},async read(url,kind='html'){
  callerSignal?.throwIfAborted();signal.throwIfAborted()
  if(!allowedURL(url)||++count>40)throw Error('Rapid7 current request outside declared native contract')
  const wait=requestIntervalMs-(Date.now()-(prior.get(new URL(url).origin)||0))
  if(wait>0)await delay(wait,undefined,{signal});prior.set(new URL(url).origin,Date.now())
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)]),requestedAt=new Date().toISOString()
  let response,reader,complete=false
  const pending=Promise.resolve().then(()=>fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,
   headers:{Accept:kind==='json'?'application/json':kind==='js'?'application/javascript':kind==='css'?'text/css':'text/html,application/xhtml+xml'}}))
  pending.then(value=>{if(!response&&requestSignal.aborted)disposeResponseBody(value,{bestEffort:true}).catch(()=>{})},()=>{})
  try{
   response=await race(pending,requestSignal)
   await requireNativeHttpResponse(response,url,{context:'Rapid7 current native read',signal:requestSignal,callerSignal:callerSignal??null})
   const mime=response.headers.get('content-type')||'',pattern={json:/(?:application|text)\/(?:[\w.+-]*\+)?json\b/i,
    html:/text\/html|application\/xhtml\+xml/i,js:/(?:application|text)\/(?:x-)?(?:java|ecma)script/i,css:/text\/css/i}[kind]
   if(!pattern?.test(mime)||!response.body)throw Error('Rapid7 current native MIME/body contract changed')
   reader=response.body.getReader();const chunks=[];let bytes=0
   for(;;){const part=await race(reader.read(),requestSignal);requestSignal.throwIfAborted();if(part.done){complete=true;break}
    bytes+=part.value.byteLength;total+=part.value.byteLength;if(bytes>2000000||total>16000000)throw Error('Rapid7 current native byte bound exceeded');chunks.push(Buffer.from(part.value))}
   const body=Buffer.concat(chunks,bytes),text=new TextDecoder('utf-8',{fatal:true}).decode(body),receipt={url,status:response.status,
    bodyBytes:bytes,bodySHA256:createHash('sha256').update(body).digest('hex'),requestedAt,completedAt:new Date().toISOString()}
   receipts.push(receipt)
   return {...receipt,text,...(kind==='json'?{value:JSON.parse(text)}:{})}
  }catch(error){
   let cleanup
   if(reader&&!complete){
    const ownedReader=reader;reader=null
    cleanup=disposeResponseReader(ownedReader,{bestEffort:true}).finally(()=>{try{ownedReader.releaseLock()}catch{}})
   }else if(!reader&&response&&!response.bodyUsed)cleanup=disposeResponseBody(response,{bestEffort:true})
   if(callerSignal?.aborted){cleanup?.catch(()=>{});callerSignal.throwIfAborted()}
   if(cleanup)await cleanup
   throw error
  }finally{try{reader?.releaseLock()}catch{}}
 }}
}
