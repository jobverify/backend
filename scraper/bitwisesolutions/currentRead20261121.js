import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'

export function currentReader(home,options={}){
 const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Bitwise native transport: '+message),{nativeContradiction:true,abortRetries:true,failureKind:'parser_or_contract_error'})}
 const sourceMs=options.sourceTimeoutMs??180000,requestMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??1200,maximum=options.maxRequests??90
 need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=180000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=20000,'invalid finite deadlines')
 need(Number.isSafeInteger(interval)&&interval>=0&&(interval>=1000||options.fetchImpl),'invalid native pacing')
 need(Number.isSafeInteger(maximum)&&maximum>=0&&maximum<=90,'invalid finite request cap')
 const origin=new URL(home).origin,allowed=new Set(['GET '+home]),denied=new Set(),used=new Set(),receipts=[],controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,timer=setTimeout(()=>controller.abort(new DOMException('Bitwise source deadline','TimeoutError')),sourceMs)
 let phase=null,count=0,total=0,lastAt=0
 const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted()}
 const race=async(promise,requestSignal)=>{let listener;try{return await Promise.race([promise,new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()})])}finally{if(listener)requestSignal.removeEventListener('abort',listener)}}
 return{check,denied,receipts,close(){clearTimeout(timer);controller.abort()},phase(value){need(['opening','closing'].includes(value)&&phase!==value,'invalid repeated phase');phase=value},allow(url,method='GET'){const target=new URL(url);need(target.origin===origin&&target.protocol==='https:'&&!target.port&&!target.username&&!target.password&&!target.hash&&!target.search,'undeclared public origin or URL');need(method==='GET'||method==='POST'&&target.pathname==='/api/careers','unsupported public method');allowed.add(method+' '+url)},async callback(fn,value){await race(Promise.resolve().then(()=>fn(value)),signal);check()},async read(url,{kind='html',method='GET',body}={}){
  check();const key=method+' '+url;need(phase&&allowed.has(key)&&new URL(url).origin===origin,'request lacks current declaration');need(!used.has(phase+' '+key),'no repeated request or retry within observation');need(!denied.has(origin),'origin already denied');need(count<maximum,'caller request budget exhausted');need(['html','program','json'].includes(kind),'unsupported resource kind');need(method==='GET'?body==null:kind==='json'&&body==='{}','unqualified request body')
  used.add(phase+' '+key);count++
  const pause=interval-(Date.now()-lastAt);if(pause>0)await delay(pause,undefined,{signal});check();lastAt=Date.now()
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(requestMs)]),receipt={phase,requestedUrl:url,method,requestBody:body??null,startedAt:new Date().toISOString()};receipts.push(receipt)
  let response,reader,complete=false
  const headers=method==='POST'?{'Content-Type':'application/json'}:{Accept:kind==='json'?'application/json':kind==='program'?'application/javascript,text/javascript':'text/html,application/xhtml+xml'}
  const pending=Promise.resolve().then(()=>(options.fetchImpl??globalThis.fetch)(url,{method,redirect:'manual',credentials:'omit',signal:requestSignal,headers,...(method==='POST'?{body}:{})}))
  pending.then(value=>{if(!response&&requestSignal.aborted)disposeResponseBody(value,{bestEffort:true}).catch(()=>{})},()=>{})
  try{
   response=await race(pending,requestSignal);need(response?.url===url&&response.redirected===false&&Number.isInteger(response.status)&&response.headers?.get,'original Response metadata unavailable or redirected')
   if([202,401,402,403,406,407,429,451].includes(response.status))denied.add(origin)
   const chunks=[];let bytes=0
   if(response.body){reader=response.body.getReader();for(;;){const part=await race(reader.read(),requestSignal);requestSignal.throwIfAborted();if(part.done){complete=true;break}need(types.isUint8Array(part.value),'original byte stream unavailable');const chunk=Buffer.from(part.value);need(chunk.length<=4000000-bytes&&chunk.length<=64000000-total,'native byte budget exceeded');chunks.push(chunk);bytes+=chunk.length;total+=chunk.length}}else complete=true
   const original=Buffer.concat(chunks);Object.assign(receipt,{url:response.url,status:response.status,redirected:response.redirected,headers:Object.fromEntries(response.headers),bytes:original.length,sha256:createHash('sha256').update(original).digest('hex'),bodyBase64:original.toString('base64'),bodyComplete:true,completedAt:new Date().toISOString()})
   if(response.status!==200)throw Object.assign(Error('Bitwise native HTTP '+response.status),{status:response.status,nativeUnavailable:response.status>=500||denied.has(origin)})
   need(kind==='html'?/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type')??''):kind==='json'?/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??''):/^(?:text|application)\/(?:javascript|ecmascript)(?:;|$)/i.test(response.headers.get('content-type')??''),'native resource MIME differs')
   return{...receipt,text:new TextDecoder('utf8',{fatal:true}).decode(original)}
  }catch(error){receipt.error=error.message;check();throw error}finally{if(reader&&!complete)await disposeResponseReader(reader,{bestEffort:true});else if(!reader&&response&&!complete)await disposeResponseBody(response,{bestEffort:true});try{reader?.releaseLock()}catch{}}
 }}
}
export const nativeUnavailable=error=>!error.nativeContradiction&&(error.nativeUnavailable||error.name==='TimeoutError'||error instanceof TypeError&&error.message==='fetch failed'||/^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_\w+)$/.test(error.cause?.code??error.code??''))
