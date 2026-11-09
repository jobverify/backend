import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {performance} from 'node:perf_hooks'

const byteLengthOf=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const acceptsMediaType=(value,kind)=>{
 if(typeof value!=='string')return false
 const type=value.split(';',1)[0].trim().toLowerCase()
 if(kind==='json')return /^(?:application|text)\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/.test(type)
 if(kind==='js')return /^(?:application|text)\/(?:x-)?(?:java|ecma)script$/.test(type)||type==='text/js'
 return type==='text/html'||type==='application/xhtml+xml'
}

// This reader owns every response, including a fetch that ignores cancellation
// and resolves after its caller has left. It never follows a redirect or executes
// a downloaded client. Bounds apply to the complete source, not each job alone.
export function createAvizvaPublicReader(options,allowedURL){
 const {signal:caller,fetchImpl=globalThis.fetch}=options
 caller?.throwIfAborted()
 const bound=(name,fallback,maximum)=>{
  const value=options[name]??fallback
  if(!Number.isSafeInteger(value)||value<1||value>maximum)throw Error('AVIZVA invalid '+name)
  return value
 }
 const timeoutMs=bound('timeoutMs',180000,180000)
 const requestTimeoutMs=bound('requestTimeoutMs',20000,20000)
 const maxRequests=bound('maxRequests',128,128)
 const maxResponseBytes=bound('maxResponseBytes',2097152,2097152)
 const maxTotalBytes=bound('maxTotalBytes',16777216,16777216)
 const interval=options.requestIntervalMs??1000
 if(!Number.isSafeInteger(interval)||interval<0||interval>10000||interval<1000&&fetchImpl===globalThis.fetch)
  throw Error('AVIZVA invalid requestIntervalMs')
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const started=performance.now(),sourceTimeout=Error('AVIZVA source deadline exceeded')
 const timer=setTimeout(()=>controller.abort(sourceTimeout),timeoutMs)
 const receipts=[],prior=new Map()
 let total=0,requests=0
 const check=()=>{
  if(caller?.aborted)throw caller.reason
  if(performance.now()-started>=timeoutMs&&!controller.signal.aborted)controller.abort(sourceTimeout)
  signal.throwIfAborted()
 }
 const read=async(url,kind='html')=>{
  check()
  const target=new URL(url)
  if(target.protocol!=='https:'||target.username||target.password||target.port||!allowedURL(url)||++requests>maxRequests)
   throw Error('AVIZVA request outside bounded public contract')
  const wait=interval-(Date.now()-(prior.get(target.origin)||0))
  if(wait>0)try{await delay(wait,undefined,{signal})}catch(error){check();throw error}
  check();prior.set(target.origin,Date.now())
  const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal])
  const requestStarted=performance.now(),requestTimeout=Error('AVIZVA request deadline exceeded')
  const requestTimer=setTimeout(()=>requestController.abort(requestTimeout),requestTimeoutMs)
  const receipt={url,method:'GET',requestedAt:new Date().toISOString(),status:null}
  receipts.push(receipt)
  let response,reader,readerCancel,listener,finished=false
  const disposed=new Set()
  const dispose=(resource,method)=>{
   if(!resource||disposed.has(resource))return
   try{
    const cancel=method??resource.cancel
    if(typeof cancel!=='function')return
    disposed.add(resource)
    Promise.resolve(cancel.call(resource)).catch(()=>{})
   }catch{}
  }
  const cleanup=()=>{
   if(reader)dispose(reader,readerCancel)
   else try{dispose(response?.body)}catch{}
  }
  const checkRequest=()=>{
   check()
   if(performance.now()-requestStarted>=requestTimeoutMs&&!requestController.signal.aborted)requestController.abort(requestTimeout)
   requestSignal.throwIfAborted()
  }
  const operation=async()=>{
   response=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,
    headers:{Accept:kind==='json'?'application/json':kind==='js'?'application/javascript,text/javascript,text/js':'text/html,application/xhtml+xml'}})
   if(finished){cleanup();checkRequest();throw Error('AVIZVA late response')}
   checkRequest()
   receipt.status=response.status;receipt.finalUrl=response.url||url
   if(response.status!==200)throw Object.assign(Error('AVIZVA public read HTTP '+response.status),{status:response.status,abortRetries:true})
   if(receipt.finalUrl!==url)throw Error('AVIZVA unexpected final URL')
   const mime=response.headers?.get('content-type')||''
   receipt.contentType=mime
   if(!acceptsMediaType(mime,kind))throw Error('AVIZVA unexpected response MIME')
   if(Number(response.headers?.get('content-length'))>maxResponseBytes)throw Error('AVIZVA declared response byte limit exceeded')
   if(typeof response.body?.getReader!=='function')throw Error('AVIZVA missing readable response body')
   const acquired=response.body.getReader()
   if(typeof acquired?.then==='function'){
    // A malformed asynchronous acquisition still owns a future resource. The
    // body is disposed now and the eventual reader independently on settlement.
    Promise.resolve(acquired).then(value=>dispose(value),()=>{})
    throw Error('AVIZVA malformed asynchronous stream reader')
   }
   const readNext=acquired?.read,cancel=acquired?.cancel
   if(typeof readNext!=='function'||typeof cancel!=='function'){
    dispose(acquired,cancel)
    throw Error('AVIZVA malformed stream reader')
   }
   reader=acquired;readerCancel=cancel
   const chunks=[];let size=0
   while(true){
    const part=await readNext.call(reader);checkRequest()
    if(!part||typeof part!=='object'||typeof part.done!=='boolean')throw Error('AVIZVA malformed stream chunk')
    if(part.done)break
    const chunk=part.value
    if(!(chunk instanceof Uint8Array))throw Error('AVIZVA stream chunk must contain bytes')
    let bytes
    try{bytes=byteLengthOf.call(chunk)}catch{throw Error('AVIZVA invalid stream byte chunk')}
    if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('AVIZVA invalid stream byte length')
    if(bytes>maxResponseBytes-size||bytes>maxTotalBytes-total)throw Error('AVIZVA response or aggregate byte limit exceeded')
    size+=bytes;total+=bytes
    chunks.push(Buffer.from(chunk))
   }
   const body=Buffer.concat(chunks)
   const text=new TextDecoder('utf-8',{fatal:true}).decode(body)
   Object.assign(receipt,{body:text,bodyBytes:body.length,bodySHA256:createHash('sha256').update(body).digest('hex')})
   checkRequest()
   if(kind!=='json')return text
   let parsed
   try{parsed=JSON.parse(text)}catch{checkRequest();throw Error('AVIZVA malformed native JSON')}
   checkRequest()
   return parsed
  }
  try{
   return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
    listener=()=>reject(caller?.aborted?caller.reason:requestSignal.reason)
    requestSignal.addEventListener('abort',listener,{once:true})
    if(requestSignal.aborted)listener()
   })])
  }catch(error){checkRequest();throw error}
  finally{
   finished=true;clearTimeout(requestTimer)
   if(listener)requestSignal.removeEventListener('abort',listener)
   cleanup();receipt.completedAt=new Date().toISOString();checkRequest()
  }
 }
 return{read,receipts,check,close(){
  clearTimeout(timer)
  try{check()}finally{controller.abort(Error('AVIZVA public reader closed'))}
  if(caller?.aborted)throw caller.reason
  if(performance.now()-started>=timeoutMs)throw sourceTimeout
 }}
}
