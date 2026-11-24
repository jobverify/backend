import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseBody,disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
import {need} from './nativeContract.js'

// Every acquired native body has one cleanup owner. Header errors are observed
// before consumption; cleanup has its own bounded grace, not a request deadline.
export function createIkeaTransport({fetchImpl,callerSignal}={}){
 const work=new Set(),disposed=new WeakSet();let closed=false,closePromise
 const caller=()=>callerSignal?.throwIfAborted()
 const check=signal=>{caller();signal?.throwIfAborted()}
 const track=p=>{work.add(p);p.then(()=>work.delete(p),()=>work.delete(p));return p}
 async function cancelBody(response){
  const body=response?.body
  if(!body||!['object','function'].includes(typeof body)||disposed.has(body))return
  disposed.add(body)
  try{await disposeResponseBody(response,{bestEffort:true})}catch{/* Bounded cleanup is best effort; retain the primary failure. */}
 }
 async function cancelReader(reader,body){
  if(body&&['object','function'].includes(typeof body))disposed.add(body)
  try{await disposeResponseReader(reader,{bestEffort:true})}catch{/* Bounded cleanup is best effort; retain the primary failure. */}
 }
 function acquire(url,options){
  return new Promise((resolve,reject)=>{
   let settled=false,aborted=false
   const signal=options.signal,remove=()=>signal.removeEventListener('abort',abort)
   const abort=()=>{if(settled)return;settled=true;aborted=true;remove();reject(callerSignal?.aborted?callerSignal.reason:signal.reason)}
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
   const fetched=Promise.resolve().then(()=>{check(signal);need(!closed,'native transport is closed');return fetchImpl(url,options)})
   const observed=fetched.then(async response=>{
    if(aborted||closed){await cancelBody(response);return}
    settled=true;remove();resolve(response)
   },error=>{if(settled)return;settled=true;remove();reject(callerSignal?.aborted?callerSignal.reason:error)})
   track(observed)
  })
 }
 const within=(promise,signal)=>new Promise((resolve,reject)=>{
  let settled=false
  const abort=()=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(callerSignal?.aborted?callerSignal.reason:signal.reason)}
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
  Promise.resolve(promise).then(value=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);resolve(value)},error=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(callerSignal?.aborted?callerSignal.reason:error)})
 })
 async function readPage(url,{signal,headers,receipt}){
  let response,reader
  try{
   check(signal)
   response=await acquire(url,{method:'GET',headers,credentials:'omit',redirect:'manual',signal})
   need(response&&typeof response==='object'&&typeof response.headers?.get==='function','native HTTP metadata unavailable')
   Object.assign(receipt,{status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')||''})
   // A metadata-only envelope avoids the shared helper taking ownership of the
   // actual body. This reader awaits disposal in its single finally owner.
   await requireNativeHttpResponse({status:response.status,url:response.url,headers:response.headers,body:null},url,{context:'IKEA native HTTP',signal,callerSignal})
   check(signal)
   const accept=String(headers.Accept??'').split(',')[0].trim()
   const expected=accept==='application/json'?/^application\/json(?:[ \t]*;[^\r\n]*)?$/i:accept==='application/javascript'?/^application\/x-javascript(?:[ \t]*;[^\r\n]*)?$/i:accept==='text/html'?/^text\/html(?:[ \t]*;[^\r\n]*)?$/i:null
   need(expected?.test(receipt.contentType),'native HTTP MIME changed before body admission')
   const length=response.headers.get('content-length')
   need(length===null||/^\d+$/.test(length)&&Number.isSafeInteger(Number(length))&&Number(length)<=4000000,'declared HTTP body exceeds byte cap or has invalid length')
   need(typeof response.body?.getReader==='function','HTTP body unavailable')
   reader=response.body.getReader();const chunks=[];let bytes=0
   for(;;){
    check(signal)
    const part=await within(Promise.resolve().then(()=>{check(signal);return reader.read()}),signal)
    need(part&&typeof part.done==='boolean','native body stream result unavailable')
    if(part.done)break
    need(part.value instanceof Uint8Array,'native body stream bytes unavailable')
    bytes+=part.value.byteLength;need(bytes<=4000000,'HTTP body exceeds byte cap');chunks.push(Buffer.from(part.value))
   }
   check(signal)
   return{status:response.status,url:response.url,contentType:receipt.contentType,html:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks))}
  }finally{
   if(reader)await cancelReader(reader,response?.body)
   else if(response)await cancelBody(response)
   // Explicit caller ownership wins after awaited cleanup; local deadlines
   // cannot replace an already observed HTTP/read failure here.
   caller()
  }
 }
 function close(){
  if(closePromise)return closePromise
  closed=true;callerSignal?.removeEventListener('abort',close)
  closePromise=(async()=>{
   if(!work.size)return
   let timer
   try{await Promise.race([Promise.allSettled([...work]),new Promise(resolve=>{timer=setTimeout(resolve,1000)})])}finally{clearTimeout(timer)}
  })()
  return closePromise
 }
 callerSignal?.addEventListener('abort',close,{once:true})
 return{readPage,close}
}
