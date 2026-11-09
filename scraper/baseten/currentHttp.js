import {createHash} from 'node:crypto'

const sha=value=>createHash('sha256').update(value).digest('hex')
const dispose=(value,reason)=>{try{Promise.resolve(value?.cancel?.(reason)).catch(()=>{})}catch{}}

// Own both late fulfillment and late rejection. An injected transport/reader
// that ignores AbortSignal must not retain an unread response after rejection.
function owned(operation,signal,late=()=>{}){
 signal.throwIfAborted()
 return new Promise((resolve,reject)=>{
  let settled=false
  const finish=(callback,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);callback(value)}
  const abort=()=>finish(reject,signal.reason)
  signal.addEventListener('abort',abort,{once:true})
  let pending
  try{pending=operation()}catch(error){finish(reject,error);return}
  Promise.resolve(pending).then(value=>{
   if(settled){try{late(value)}catch{};return}
   if(signal.aborted){try{late(value)}catch{};abort();return}
   finish(resolve,value)
  },error=>finish(reject,error))
 })
}

export function createBasetenHttpReader({fetchImpl,signal,fail,receipts,requestTimeoutMs}){
 const responseByteLimit=12000000,aggregateByteLimit=48000000,requestLimit=64
 let aggregateBytes=0
 async function request(url,kind,status=200,canonicalHop=false){
  signal.throwIfAborted()
  if(receipts.length>=requestLimit)fail('source request bound exceeded')
  const receipt={url,method:'GET',observedAt:new Date().toISOString(),kind};receipts.push(receipt)
  const timeout=new AbortController(),tick=setTimeout(()=>timeout.abort(new Error('[baseten] request deadline exceeded: '+url)),requestTimeoutMs)
  const requestSignal=AbortSignal.any([signal,timeout.signal])
  let response,reader,bodyOwned=false
  try{
   response=await owned(()=>fetchImpl(url,{method:'GET',redirect:'manual',headers:{Accept:kind==='json'?'application/json':'*/*','User-Agent':'Mozilla/5.0 (compatible; Jobverify source verification)'},signal:requestSignal}),requestSignal,value=>dispose(value?.body,requestSignal.reason))
   requestSignal.throwIfAborted()
   Object.assign(receipt,{status:response.status,finalUrl:response.url,contentType:response.headers.get('content-type'),location:response.headers.get('location')})
   if(response.url!==url)fail('native HTTP identity/status/size changed: '+url)
   if(!canonicalHop&&url==='https://www.baseten.co/resources/careers/'&&response.status===308){
    let target
    try{target=new URL(receipt.location,url).href}catch{}
    if(target!=='https://www.baseten.co/resources/careers')fail('unqualified public hiring redirect: '+url)
    receipt.bodyRead=false;receipt.redirectTarget=target
    // A redirect is qualified by its actual status/Location; do not manufacture
    // an empty raw body or follow it through the transport's redirect mechanism.
    dispose(response.body);bodyOwned=true
    clearTimeout(tick)
    return await request(target,kind,status,true)
   }
   if(response.status!==status)fail('native HTTP identity/status/size changed: '+url)
   const mime=receipt.contentType||''
   if(kind==='html'&&!/^text\/html\b/i.test(mime)||kind==='json'&&!/^application\/json\b/i.test(mime)||kind==='script'&&!/^(?:text|application)\/(?:java|ecma)script\b/i.test(mime)||kind==='stylesheet'&&!/^text\/css\b/i.test(mime))fail('native response content type changed: '+url)
   const declared=response.headers.get('content-length')
   if(declared!=null&&(!/^\d+$/.test(declared)||Number(declared)>responseByteLimit||aggregateBytes+Number(declared)>aggregateByteLimit))fail('response declared byte bound exceeded: '+url)
   if(!response.body||typeof response.body.getReader!=='function')fail('native response readable body unavailable: '+url)
   reader=await owned(()=>response.body.getReader(),requestSignal,value=>dispose(value,requestSignal.reason));bodyOwned=true
   const chunks=[];let bytes=0,reads=0
   while(true){
    requestSignal.throwIfAborted()
    if(++reads>65536)fail('response stream read bound exceeded: '+url)
    const part=await owned(()=>reader.read(),requestSignal)
    if(part.done===true)break
    if(!(part.value instanceof Uint8Array))fail('native response stream bytes unavailable: '+url)
    bytes+=part.value.byteLength
    if(bytes>responseByteLimit||aggregateBytes+bytes>aggregateByteLimit)fail('response streamed byte bound exceeded: '+url)
    chunks.push(Buffer.from(part.value))
   }
   requestSignal.throwIfAborted()
   const raw=Buffer.concat(chunks)
   if(!raw.length)fail('native HTTP identity/status/size changed: '+url)
   aggregateBytes+=raw.length
   const body=new TextDecoder('utf-8',{fatal:true}).decode(raw)
   Object.assign(receipt,{sha256:sha(raw),nativeTextSha256:sha(body),bytes:raw.length,bodyRead:true,completedAt:new Date().toISOString()})
   return {body,receipt,response}
  }catch(error){receipt.error=error?.message??String(error);requestSignal.throwIfAborted();throw error}
  finally{
   clearTimeout(tick)
   if(reader){dispose(reader,requestSignal.reason);try{reader.releaseLock?.()}catch{}}
   else if(response&&!bodyOwned)dispose(response.body,requestSignal.reason)
   receipt.completedAt??=new Date().toISOString()
  }
 }
 return request
}
