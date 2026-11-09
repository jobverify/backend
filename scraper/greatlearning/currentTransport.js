import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {failure,need,isFailure,HOME} from './currentDeclarations.js'

export const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
export const budget=(value,max,label)=>{if(value===undefined)return max;if(!Number.isSafeInteger(value)||value<=0||value>max)throw RangeError('Great Learning native invalid '+label);return value}
export const cap=(value,label)=>{if(value===undefined||value===null||value===Infinity)return Infinity;if(!Number.isSafeInteger(value)||value<0)throw RangeError('Great Learning native invalid '+label);return value}
function controls(parent,sourceMs){
 const started=performance.now(),controller=new AbortController(),waiters=new Set();let stopped=false,reason
 const fail=value=>{if(!stopped){stopped=true;reason=parent?.aborted?parent.reason:value;controller.abort(reason);for(const reject of [...waiters])reject(reason)}return reason}
 const check=()=>{if(parent?.aborted)fail(parent.reason);if(!stopped&&performance.now()-started>=sourceMs)fail(failure('source deadline exceeded'));if(stopped)throw reason}
 const onAbort=()=>fail(parent.reason);parent?.addEventListener('abort',onAbort,{once:true});if(parent?.aborted)fail(parent.reason)
 const timer=setTimeout(()=>fail(failure('source deadline exceeded')),sourceMs)
 const gate=async(fn,ms,label)=>{
  check();await Promise.resolve();check()
  const started=performance.now(),checkGate=()=>{check();if(performance.now()-started>=ms)throw fail(failure(label+' deadline exceeded'))}
  return new Promise((resolve,reject)=>{
   let settled=false,deadline
   const finish=(bad,value)=>{if(settled)return;settled=true;clearTimeout(deadline);waiters.delete(stop);bad?reject(value):resolve(value)}
   const stop=value=>finish(true,value);waiters.add(stop)
   deadline=setTimeout(()=>fail(failure(label+' deadline exceeded')),ms)
   Promise.resolve().then(()=>{checkGate();return fn()}).then(value=>{try{checkGate();finish(false,value)}catch(e){finish(true,e)}},error=>finish(true,fail(error)))
  })
 }
 return{signal:controller.signal,gate,check,fail,dispose(){clearTimeout(timer);parent?.removeEventListener('abort',onAbort)}}
}
export function transport(options){
 const readMs=budget(options.readTimeoutMs,15000,'read timeout'),observerMs=budget(options.observerTimeoutMs,15000,'observer timeout'),sourceMs=budget(options.sourceTimeoutMs??options.timeoutMs,180000,'source timeout'),control=controls(options.signal,sourceMs),originals=[],allowed=new Set([HOME])
 let totalBytes=0
 const read=(url,kind='html',expectedStatus=200)=>control.gate(async()=>{
  control.check();need(allowed.has(url)&&originals.length<256,'unadmitted or excessive public request')
  const requestHeaders={Accept:kind==='css'?'text/css':kind==='json'?'application/json':kind==='javascript'?'application/javascript':'text/html'},original={source:'greatlearning',sequence:originals.length+1,requestedURL:url,method:'GET',body:null,requestHeaders:{...requestHeaders},startedAt:new Date().toISOString(),originalBodyComplete:false}
  originals.push(original)
  let result,bytes
  try{
   if(options.fetchResponse){
    result=await options.fetchResponse(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{...requestHeaders},signal:control.signal});control.check()
    Object.assign(original,{status:result?.status,finalURL:result?.finalURL,headers:{...result?.headers},contentType:result?.contentType||''})
    if(!Number.isInteger(result?.status)||result.status!==expectedStatus)throw control.fail(failure('HTTP '+result?.status+' at '+url))
    need(Buffer.isBuffer(result?.bytes)||result?.bytes instanceof Uint8Array,'missing original response bytes')
    bytes=Buffer.from(result.bytes)
   }else{
    result=await boundedDeclaredPublicGet(url,{signal:control.signal,overflowError:failure('original response byte limit exceeded'),fetchImpl:async(requested,init)=>{
     control.check()
     const response=await (options.fetchImpl||globalThis.fetch)(requested,{...init,headers:{...requestHeaders},credentials:'omit',cache:'no-store'})
     // The shared primitive owns cancellation, including a late response. Do
     // not touch or reject that response here before handing ownership back.
     if(control.signal.aborted)return response
     Object.assign(original,{status:response.status,finalURL:response.url,headers:Object.fromEntries(response.headers),contentType:response.headers.get('content-type')||''})
     if(!Number.isInteger(response.status)||response.status!==expectedStatus){control.fail(failure('HTTP '+response.status+' at '+url));return response}
     if(response.url!==url){control.fail(failure('unexpected redirect or response identity'));return response}
     const body=response.body;let consumed=0
     return{status:response.status,url:response.url,headers:response.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){
      const reader=body.getReader()
      return{async read(){const value=await reader.read();control.check();if(!value.done&&types.isUint8Array(value.value)){const length=byteLength.call(value.value);need(length<=4*1024*1024-consumed,'original response byte limit exceeded');consumed+=length}return value},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
     }}}
    }})
    result={...result,finalURL:result.url,contentType:result.headers['content-type']||''}
    bytes=Buffer.from(result.bodyBase64,'base64')
   }
   control.check();totalBytes+=bytes.length
   Object.assign(original,{status:result.status,finalURL:result.finalURL,headers:{...result.headers},contentType:result.contentType||'',bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyBase64:bytes.toString('base64'),originalBodyComplete:true})
   need(bytes.length>0&&bytes.length<=4*1024*1024&&totalBytes<=16*1024*1024,'empty or oversized original response')
   need(Number.isInteger(result.status)&&result.status===expectedStatus,'HTTP '+result.status+' at '+url)
   need(result.finalURL===url,'unexpected redirect or response identity')
   if(result.bodySHA256!==undefined)need(result.bodySHA256===sha(bytes),'original byte hash differs')
   const mime=kind==='css'?/^text\/css(?:;|$)/i:kind==='json'?/^application\/json(?:;|$)/i:kind==='javascript'?/^(?:application|text)\/(?:x-)?javascript(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i
   need(mime.test(result.contentType||''),'original '+kind+' MIME differs')
   let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw failure('invalid original UTF-8')}
   need(!text.includes('\u0000'),'NUL in original body');control.check()
   return{bytes,text,headers:original.headers,sha256:original.bodySHA256}
  }catch(error){
   // Caller cancellation is an opaque contract, including null and zero.
   // Ordinary transport failures instead carry the original attempt receipt.
   if(options.signal?.aborted)throw options.signal.reason
   if(control.signal.aborted)throw control.signal.reason
   if(isFailure(error))throw error
   const wrapped=failure('public GET failed at '+url)
   Object.defineProperty(wrapped,'cause',{value:error})
   original.error=wrapped.message;original.upstreamErrorName=typeof error?.name==='string'?error.name:typeof error
   throw wrapped
  }finally{original.completedAt=new Date().toISOString()}
 },readMs,'read/body')
 return{read,originals,control,allow:url=>{control.check();allowed.add(url)},observe:fn=>control.gate(fn,observerMs,'observer'),attachFailure(error){if(!options.signal?.aborted&&isFailure(error)&&Object.isExtensible(error))Object.defineProperty(error,'nativeOriginalResponses',{value:structuredClone(originals)})}}
}
