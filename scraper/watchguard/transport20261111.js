import {createHash} from 'node:crypto'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'

const need=(ok,message)=>{if(!ok)throw Error('[watchguard] '+message)}
const duration=(value,max)=>{if(!Number.isSafeInteger(value)||value<1||value>max)throw RangeError('[watchguard] invalid native deadline');return value}
const timeout=()=>new DOMException('[watchguard] source deadline exceeded','TimeoutError')
const cancel=(body,reason)=>{try{Promise.resolve(body?.cancel(reason)).catch(()=>{})}catch{}}
export function createWatchguardTransport(options,receipts){
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
  check();need(receipts.length<96,'native request budget exceeded')
  const receipt={url,method:'GET',kind,requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
  try{
   const fetchImpl=options.fetchImpl??globalThis.fetch
   const response=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestMs,overflowError:Error('[watchguard] native body byte limit exceeded'),fetchImpl:async(url,init)=>{
    const original=await fetchImpl(url,{...init,credentials:'omit'});let size=0
    try{check();init.signal.throwIfAborted();return{status:original.status,url:original.url,headers:original.headers,body:original.body===null?null:{cancel:reason=>original.body.cancel(reason),getReader(){
     const reader=original.body.getReader()
     return{async read(){const value=await reader.read();if(!value.done){size+=value.value.byteLength;need(size<12000000,'native body byte limit exceeded')}return value},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
    }}}}catch(error){cancel(original?.body,error);throw error}
   }})
   check();const bytes=Buffer.from(response.bodyBase64,'base64');aggregate+=bytes.length
   // A complete public response retains its original byte/status provenance
   // before fatal UTF-8 decoding can reject its text.
   Object.assign(receipt,{status:response.status,finalUrl:response.url,headers:response.headers,contentType:response.headers['content-type'],bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),rawBodyBase64:response.bodyBase64,bodyComplete:true})
   if(response.status!==200)throw Object.assign(Error('[watchguard] native HTTP status/URL/body changed (HTTP '+response.status+')'),{status:response.status,code:'WATCHGUARD_NATIVE_HTTP',abortRetries:true})
   need(response.status===200&&response.url===url&&bytes.length>0&&bytes.length<12000000,'native HTTP status/URL/body changed')
   need(aggregate<=64000000,'native aggregate byte limit exceeded')
   need((kind==='json'?/^application\/json\b/i:/^text\/html\b/i).test(receipt.contentType||''),'native HTTP content type changed')
   const text=new TextDecoder('utf8',{fatal:true}).decode(bytes)
   receipt.nativeTextSha256=createHash('sha256').update(text).digest('hex')
   check();return{text,receipt}
  }catch(caught){
   let error=caught
   receipt.error=error?.message??String(error)
   if(caller?.aborted)throw caller.reason
   try{check()}catch(reason){error=reason}
   if(error instanceof Error&&Object.isExtensible(error)&&receipt.bodyComplete===true){
    const retry=Object.getOwnPropertyDescriptor(error,'abortRetries')
    if(!retry||retry.configurable)Object.defineProperty(error,'abortRetries',{value:true,writable:true,configurable:true,enumerable:true})
    else if(retry.writable)error.abortRetries=true
    receipt.observedAt=new Date().toISOString()
    const packets=receipts.map(p=>({url:p.url,finalURL:p.finalUrl,status:p.status,headers:p.headers,rawBodyBase64:p.rawBodyBase64,bodyBytes:p.bytes,bodySHA256:p.sha256,requestedAt:p.requestedAt,completedAt:p.observedAt,...(p.error?{failure:{message:p.error}}:{})}))
    const existing=Object.getOwnPropertyDescriptor(error,'nativeEvidence')
    if(!existing||existing.configurable)Object.defineProperty(error,'nativeEvidence',{value:{source:'watchguard',observedListingCount:null,jobs:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,inventoryComplete:false,transportPackets:packets,retainedResponses:packets,failures:[{stage:'native-transport',message:error.message}]}})
   }
   throw error
  }finally{receipt.observedAt??=new Date().toISOString()}
 },close(){closed=true;clearTimeout(timer);if(!controller.signal.aborted)controller.abort(Error('[watchguard] source closed'))}}
}
