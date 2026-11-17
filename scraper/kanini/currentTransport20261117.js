import{createHash}from'node:crypto'
import{setTimeout as delay}from'node:timers/promises'
import{requireNativeHttpResponse}from'../../scraper-support/shared/nativeHttpResponse.js'
import{disposeResponseBody,disposeResponseReader}from'../../scraper-support/shared/responseBodyDisposal.js'
export function currentKaniniTransport({allowedRequest,fetchImpl=globalThis.fetch,signal:callerSignal,requestIntervalMs=1000,timeoutMs=180000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000||!Number.isSafeInteger(requestIntervalMs)||requestIntervalMs<0||requestIntervalMs<1000&&fetchImpl===globalThis.fetch)throw Error('KANINI invalid native transport limits')
 const sourceStarted=performance.now(),sourceReason=Error('KANINI current source deadline exceeded'),owner=new AbortController(),timer=setTimeout(()=>owner.abort(sourceReason),timeoutMs),signal=callerSignal?AbortSignal.any([callerSignal,owner.signal]):owner.signal,prior=new Map(),receipts=[]
 const check=()=>{callerSignal?.throwIfAborted();if(performance.now()-sourceStarted>=timeoutMs&&!owner.signal.aborted)owner.abort(sourceReason);signal.throwIfAborted()}
 let count=0,total=0
 const race=async(pending,requestSignal)=>{let listener;try{return await Promise.race([pending,new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()})])}finally{if(listener)requestSignal.removeEventListener('abort',listener)}}
 return{receipts,close(){clearTimeout(timer);owner.abort()},async read(url,kind='html',body){
  check();const method=body===undefined?'GET':'POST';if(!allowedRequest(url,method,body)||++count>96)throw Error('KANINI request outside declared read-only native contract')
  const wait=requestIntervalMs-(Date.now()-(prior.get(new URL(url).origin)||0));if(wait>0)try{await delay(wait,undefined,{signal})}catch(e){callerSignal?.throwIfAborted();signal.throwIfAborted();throw e}
  check();prior.set(new URL(url).origin,Date.now())
  const requestStarted=performance.now(),elapsed=new AbortController(),requestSignal=AbortSignal.any([signal,AbortSignal.timeout(25000),elapsed.signal]),requestedAt=new Date().toISOString();let response,reader,complete=false
  const requestCheck=()=>{check();if(performance.now()-requestStarted>=25000&&!elapsed.signal.aborted)elapsed.abort(new DOMException('KANINI current request deadline exceeded','TimeoutError'));requestSignal.throwIfAborted()}
  const pending=Promise.resolve().then(()=>fetchImpl(url,{method,redirect:'manual',credentials:'omit',signal:requestSignal,headers:{Accept:kind==='json'?'application/json':kind==='js'?'application/javascript':'text/html,application/xhtml+xml',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest',Referer:'https://kanini.com/careers/open-positions/'}:{})},...(body===undefined?{}:{body})}))
  pending.then(value=>{if(!response&&requestSignal.aborted)disposeResponseBody(value,{bestEffort:true}).catch(()=>{})},()=>{})
  try{response=await race(pending,requestSignal);await requireNativeHttpResponse(response,url,{context:'KANINI current native read',signal:requestSignal,callerSignal:callerSignal??null});requestCheck()
   const pattern={html:/^(?:text\/html|application\/xhtml\+xml)[ \t]*(?:;|$)/i,js:/^(?:application|text)\/(?:x-)?(?:java|ecma)script[ \t]*(?:;|$)/i,json:/^(?:application|text)\/(?:[\w.+-]*\+)?json[ \t]*(?:;|$)/i}[kind]
   if(!pattern?.test(response.headers.get('content-type')??'')||!response.body)throw Error('KANINI native MIME/body changed')
   reader=response.body.getReader();const chunks=[];let bytes=0;for(;;){requestCheck();const p=await race(reader.read(),requestSignal);requestCheck();if(p.done){complete=true;break}bytes+=p.value.byteLength;total+=p.value.byteLength;if(bytes>4000000||total>32000000)throw Error('KANINI native byte budget exceeded');chunks.push(Buffer.from(p.value))}
   const b=Buffer.concat(chunks,bytes),text=new TextDecoder('utf-8',{fatal:true}).decode(b),receipt={url,method,...(body===undefined?{}:{readOnlySearchBody:body}),status:response.status,bodyBytes:bytes,bodySHA256:createHash('sha256').update(b).digest('hex'),requestedAt,completedAt:new Date().toISOString()},value=kind==='json'?{value:JSON.parse(text)}:{};requestCheck();receipts.push(receipt);return{...receipt,text,...value}
  }catch(e){let cleanup;if(reader&&!complete){const owned=reader;reader=null;cleanup=disposeResponseReader(owned,{bestEffort:true}).finally(()=>{try{owned.releaseLock()}catch{}})}else if(!reader&&response&&!response.bodyUsed)cleanup=disposeResponseBody(response,{bestEffort:true})
   if(callerSignal?.aborted){cleanup?.catch(()=>{});callerSignal.throwIfAborted()}if(cleanup)await cleanup;callerSignal?.throwIfAborted();throw e
  }finally{try{reader?.releaseLock()}catch{}}
 }}
}
