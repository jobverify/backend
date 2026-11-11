import {createHash} from 'node:crypto'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'

const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[lennoxinternational] '+message),{abortRetries:true})}
const duration=(value,max)=>{if(!Number.isSafeInteger(value)||value<1||value>max)throw RangeError('[lennoxinternational] invalid native deadline');return value}
const timeout=()=>new DOMException('[lennoxinternational] source deadline exceeded','TimeoutError')
const cancel=(body,reason)=>{try{Promise.resolve(body?.cancel(reason)).catch(()=>{})}catch{}}
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
export function createLennoxTransport(options,receipts){
 const caller=options.signal,sourceMs=duration(options.sourceTimeoutMs??180000,180000),requestMs=duration(options.requestTimeoutMs??30000,30000)
 caller?.throwIfAborted()
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,deadline=performance.now()+sourceMs
 const timer=setTimeout(()=>controller.abort(timeout()),sourceMs)
 let aggregate=0,closed=false
 const check=()=>{caller?.throwIfAborted();if(performance.now()>=deadline&&!controller.signal.aborted)controller.abort(timeout());signal.throwIfAborted();need(!closed,'native reader closed')}
 const race=operation=>new Promise((resolve,reject)=>{
  let settled=false
  const finish=(method,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',aborted);method(value)}
  const aborted=()=>finish(reject,caller?.aborted?caller.reason:signal.reason)
  signal.addEventListener('abort',aborted,{once:true})
  Promise.resolve().then(()=>{check();return operation()}).then(value=>{try{check();finish(resolve,value)}catch(error){finish(reject,error)}},error=>{try{check()}catch(reason){error=reason}finish(reject,error)})
  if(signal.aborted)aborted()
 })
 return{check,race,signal,async read(url,kind){
  check();need(receipts.length<64,'native request budget exceeded')
  const receipt={url,method:'GET',kind,requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
  try{
   const fetchImpl=options.fetchImpl??globalThis.fetch
   const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestMs,overflowError:Error('[lennoxinternational] native body byte limit exceeded'),fetchImpl:async(url,init)=>{
    // Match the ordinary Node GET representation used by the retained public
    // capture. iCIMS supplies a different merged SSR template for the shared
    // primitive's crawler User-Agent; it is not this reviewed iframe contract.
    const original=await fetchImpl(url,{...init,credentials:'omit',headers:{...init.headers,Accept:'text/html','User-Agent':'node'}});let size=0
    try{check();init.signal.throwIfAborted();return{status:original.status,url:original.url,headers:original.headers,body:original.body===null?null:{cancel:reason=>original.body.cancel(reason),getReader(){
     const reader=original.body.getReader()
     return{async read(){const value=await reader.read();if(!value.done){size+=byteLength.call(value.value);need(size<2000000,'native body byte limit exceeded')}return value},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
    }}}}catch(error){cancel(original?.body,error);throw error}
   }})
   check();const bytes=Buffer.from(response.bodyBase64,'base64');aggregate+=bytes.length
   // Preserve complete response provenance before qualifying its text. Even a
   // malformed UTF-8 denial page has an authoritative status and original bytes.
   Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:response.headers,contentType:response.headers['content-type'],bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),rawBodyBase64:response.bodyBase64,bodyComplete:true})
   if(response.status!==200)throw Object.assign(Error('[lennoxinternational] native HTTP '+response.status),{status:response.status,code:'LENNOX_NATIVE_HTTP',abortRetries:true})
   need(response.status===200&&response.url===url&&bytes.length>0&&bytes.length<2000000,'native HTTP status/URL/body changed')
   need(aggregate<=16000000,'native aggregate byte limit exceeded')
   need((kind==='json'?/^application\/json\b/i:/^text\/html\b/i).test(receipt.contentType||''),'native HTTP content type changed')
   const text=new TextDecoder('utf8',{fatal:true}).decode(bytes)
   receipt.nativeTextSha256=createHash('sha256').update(text).digest('hex')
   check();return{text,receipt}
  }catch(error){receipt.error=error?.message??String(error);if(caller?.aborted)throw caller.reason;check();throw error}
  finally{receipt.observedAt=new Date().toISOString()}
 },close(){closed=true;clearTimeout(timer);if(!controller.signal.aborted)controller.abort(Error('[lennoxinternational] source closed'))}}
}
