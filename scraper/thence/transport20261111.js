import {createHash} from 'node:crypto'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'

const need=(ok,message)=>{if(!ok)throw Object.assign(Error('[thence] '+message),{abortRetries:true})}
const duration=(value,max)=>{if(!Number.isSafeInteger(value)||value<1||value>max)throw RangeError('[thence] invalid native deadline');return value}
const timeout=()=>new DOMException('[thence] source deadline exceeded','TimeoutError')
const cancel=(body,reason)=>{try{Promise.resolve(body?.cancel(reason)).catch(()=>{})}catch{}}
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
export function createThenceTransport(options,receipts){
 const caller=options.signal
 caller?.throwIfAborted()
 const sourceMs=duration(options.sourceTimeoutMs??120000,180000),requestMs=duration(options.requestTimeoutMs??20000,30000)
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
 return{check,race,signal,async read(url,kind,expectedStatus=200){
  check();need(receipts.length<12,'native request budget exceeded')
  need(['https://thence.co','https://thence.digital/','https://www.thence.digital/','https://www.thence.digital/careers'].includes(url)&&['html','redirect'].includes(kind)&&[200,301,308].includes(expectedStatus),'unreviewed public request authority/status')
  const receipt={url,method:'GET',kind,requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
  try{
   const fetchImpl=options.fetchImpl??globalThis.fetch
   const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestMs,overflowError:Error('[thence] native body byte limit exceeded'),fetchImpl:async(url,init)=>{
    const original=await fetchImpl(url,{...init,credentials:'omit',headers:{...init.headers,Accept:'text/html','User-Agent':'node'}});let size=0
    try{check();init.signal.throwIfAborted();return{status:original.status,url:original.url,headers:original.headers,body:original.body===null?null:{cancel:reason=>original.body.cancel(reason),getReader(){
     const reader=original.body.getReader()
     return{async read(){const value=await reader.read();if(!value.done){size+=byteLength.call(value.value);need(size<2000000,'native body byte limit exceeded')}return value},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
    }}}}catch(error){cancel(original?.body,error);throw error}
   }})
   check();const bytes=Buffer.from(response.bodyBase64,'base64');aggregate+=bytes.length
   // Byte/status provenance precedes text qualification. A malformed UTF-8
   // error page must retain its real HTTP status and original response bytes.
   Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:response.headers,contentType:response.headers['content-type'],bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),rawBodyBase64:response.bodyBase64,bodyComplete:true})
   if(response.status!==expectedStatus)throw Object.assign(Error('[thence] native HTTP '+response.status),{status:response.status,url:response.url,code:'THENCE_NATIVE_HTTP',abortRetries:true})
   need(response.status===expectedStatus&&response.url===new URL(url).href&&bytes.length>0&&bytes.length<2000000,'native HTTP status/URL/body changed')
   need(aggregate<=8000000,'native aggregate byte limit exceeded')
   need((kind==='redirect'?/^(?:text\/html|application\/json)\b/i:/^text\/html\b/i).test(receipt.contentType||''),'native HTTP content type changed')
   const text=new TextDecoder('utf8',{fatal:true}).decode(bytes)
   receipt.nativeTextSha256=createHash('sha256').update(text).digest('hex')
   check();return{text,receipt}
  }catch(error){receipt.error=error?.message??String(error);if(caller?.aborted)throw caller.reason;check();throw error}
  finally{receipt.observedAt=new Date().toISOString()}
 },close(){closed=true;clearTimeout(timer);if(!controller.signal.aborted)controller.abort(Error('[thence] source closed'))}}
}
