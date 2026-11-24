import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
export function currentReader(initial,origins,options={}){
 const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Current native transport: '+message),{abortRetries:true,nativeContradiction:true,failureKind:'parser_or_contract_error'})}
 const timeout=options.sourceTimeoutMs??180000,interval=options.requestIntervalMs??1200,requestMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=20000&&Number.isSafeInteger(interval)&&interval>=0&&(interval>=1000||options.fetchImpl),'invalid finite deadlines/pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,timer=setTimeout(()=>controller.abort(new DOMException('Current source deadline','TimeoutError')),timeout),allowed=new Set(initial),perOrigin=new Map(),denied=new Set(),receipts=[]
 let count=0,total=0,exhausted=false
 const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted()}
 const race=async(pending,s)=>{let listener;try{return await Promise.race([pending,new Promise((_,reject)=>{listener=()=>reject(s.reason);s.addEventListener('abort',listener,{once:true});if(s.aborted)listener()})])}finally{if(listener)s.removeEventListener('abort',listener)}}
 return{check,denied,receipts,allow(url){const u=new URL(url);need(u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&origins.includes(u.origin),'unbound declared public origin');allowed.add(url)},close(){clearTimeout(timer);controller.abort()},async callback(fn,value){return race(Promise.resolve().then(()=>fn(value)),signal)},async read(url,{navigation=false,kind='html'}={}){
  check();need(allowed.has(url),'undeclared public request');const u=new URL(url);need(origins.includes(u.origin),'unbound native origin')
  if(denied.has(u.origin))throw Object.assign(Error('Native origin previously denied'),{nativeUnavailable:true,status:202})
  if(exhausted||++count>128){exhausted=true;throw Object.assign(Error('Finite native read budget exhausted'),{nativeUnavailable:true})}
  const pause=interval-(Date.now()-(perOrigin.get(u.origin)??0));if(pause>0)await delay(pause,undefined,{signal});check();perOrigin.set(u.origin,Date.now())
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(requestMs)]),receipt={requestedUrl:url,method:'GET',startedAt:new Date().toISOString()};receipts.push(receipt)
  let response,reader,complete=false
  need(['html','program','json'].includes(kind),'unknown declared resource kind')
  const pending=Promise.resolve().then(()=>(options.fetchImpl??globalThis.fetch)(url,{method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,headers:{Accept:kind==='json'?'application/json':kind==='program'?'application/javascript,text/javascript':'text/html,application/xhtml+xml'}}))
  pending.then(r=>{if(!response&&requestSignal.aborted)disposeResponseBody(r,{bestEffort:true}).catch(()=>{})},()=>{})
  try{
   response=await race(pending,requestSignal);need(response?.url===url&&response.redirected===false&&Number.isInteger(response.status)&&response.headers?.get,'original Response identity/redirect metadata unavailable')
   if([202,401,402,403,406,407,429,451].includes(response.status))denied.add(u.origin)
   const chunks=[];let byteCount=0;if(response.body){reader=response.body.getReader();for(;;){const part=await race(reader.read(),requestSignal);requestSignal.throwIfAborted();if(part.done){complete=true;break}need(types.isUint8Array(part.value),'original byte chunk unavailable');const chunk=Buffer.from(part.value);if(chunk.length>4000000-byteCount||chunk.length>32000000-total){exhausted=true;throw Object.assign(Error('Finite original body budget exhausted'),{nativeUnavailable:true})}byteCount+=chunk.length;total+=chunk.length;chunks.push(chunk)}}else complete=true
   const bytes=Buffer.concat(chunks);Object.assign(receipt,{url:response.url,status:response.status,redirected:response.redirected,headers:Object.fromEntries(response.headers),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),bodyBase64:bytes.toString('base64'),bodyComplete:true})
   if(navigation&&[301,302,307,308].includes(response.status))return{...receipt,text:new TextDecoder('utf8',{fatal:true}).decode(bytes)}
   if(response.status!==200)throw Object.assign(Error('Native HTTP '+response.status),{status:response.status,nativeUnavailable:denied.has(u.origin)||response.status>=500})
   need(kind==='html'?/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type')??''):kind==='json'?/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??''):/^(?:text|application)\/(?:javascript|ecmascript)(?:;|$)/i.test(response.headers.get('content-type')??''),'native declared document MIME differs')
   return{...receipt,text:new TextDecoder('utf8',{fatal:true}).decode(bytes)}
  }catch(error){receipt.error=error.message;check();throw error}finally{if(reader&&!complete)await disposeResponseReader(reader,{bestEffort:true});else if(!reader&&response&&!complete)await disposeResponseBody(response,{bestEffort:true});try{reader?.releaseLock()}catch{}}
 }}
}
export const nativeUnavailable=error=>!error.nativeContradiction&&(error.nativeUnavailable||error.name==='TimeoutError'||error instanceof TypeError&&error.message==='fetch failed'||/^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_\w+)$/.test(error.cause?.code??error.code??''))
