import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {failure,need,isFailure,HOME} from './currentDeclarations.js'

export const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
export const budget=(value,max,label)=>{if(value===undefined)return max;if(!Number.isSafeInteger(value)||value<=0||value>max)throw RangeError('BTL India native invalid '+label);return value}
export const cap=(value,label)=>{if(value===undefined||value===null||value===Infinity)return Infinity;if(!Number.isSafeInteger(value)||value<0)throw RangeError('BTL India native invalid '+label);return value}
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
   Promise.resolve().then(()=>{checkGate();return fn(checkGate)}).then(value=>{try{checkGate();finish(false,value)}catch(e){finish(true,e)}},error=>finish(true,fail(error)))
  })
 }
 return{signal:controller.signal,gate,check,fail,dispose(){clearTimeout(timer);parent?.removeEventListener('abort',onAbort)}}
}
export function transport(options){
 const pdfMs=budget(options.pdfTimeoutMs,15000,'PDF timeout'),readMs=budget(options.readTimeoutMs,15000,'read timeout'),observerMs=budget(options.observerTimeoutMs,15000,'observer timeout'),sourceMs=budget(options.sourceTimeoutMs??options.timeoutMs,240000,'source timeout'),control=controls(options.signal,sourceMs),originals=[],allowed=new Set([HOME])
 let totalBytes=0
 const read=(url,kind='html',expectedStatus=200)=>control.gate(async()=>{
  control.check();need(allowed.has(url)&&originals.length<128,'unadmitted or excessive public request')
  const requestHeaders={Accept:kind==='pdf'?'application/pdf':kind==='css'?'text/css':kind==='json'?'application/json':kind==='javascript'?'application/javascript':'text/html'},original={source:'btlindia',sequence:originals.length+1,requestedURL:url,method:'GET',body:null,requestHeaders:{...requestHeaders},startedAt:new Date().toISOString(),originalBodyComplete:false}
  originals.push(original)
  let result,bytes
  try{
   if(options.fetchResponse){
    result=await options.fetchResponse(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{...requestHeaders},signal:control.signal})
    // Already materialized adapter responses belong to this admitted attempt,
    // even when a peer has stopped the source. Never read a new body here.
    if(options.signal?.aborted)throw options.signal.reason
    Object.assign(original,{status:result?.status,finalURL:result?.finalURL,headers:{...result?.headers},contentType:result?.contentType||''})
    need(Buffer.isBuffer(result?.bytes)||result?.bytes instanceof Uint8Array,'missing original response bytes')
    need(result.bytes.byteLength<=4*1024*1024&&result.bytes.byteLength<=32*1024*1024-totalBytes,'oversized original response')
    bytes=Buffer.from(result.bytes)
    totalBytes+=bytes.length
    Object.assign(original,{bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyBase64:bytes.toString('base64'),originalBodyComplete:true})
    control.check()
    if(!Number.isInteger(result?.status)||result.status!==expectedStatus)throw control.fail(failure('HTTP '+result?.status+' at '+url))
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
     const headerMime=kind==='pdf'?/^application\/pdf(?:;|$)/i:kind==='css'?/^text\/css(?:;|$)/i:kind==='json'?/^application\/json(?:;|$)/i:kind==='javascript'?/^(?:application|text)\/(?:x-)?javascript(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i
     if(!headerMime.test(original.contentType)){control.fail(failure('original '+kind+' MIME differs'));return response}
     const body=response.body;let consumed=0
     return{status:response.status,url:response.url,headers:response.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){
      const reader=body.getReader()
      return{async read(){const value=await reader.read();control.check();if(!value.done&&types.isUint8Array(value.value)){const length=byteLength.call(value.value);need(length<=4*1024*1024-consumed,'original response byte limit exceeded');consumed+=length}return value},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
     }}}
    }})
    result={...result,finalURL:result.url,contentType:result.headers['content-type']||''}
    bytes=Buffer.from(result.bodyBase64,'base64')
   }
   control.check();if(!options.fetchResponse)totalBytes+=bytes.length
   Object.assign(original,{status:result.status,finalURL:result.finalURL,headers:{...result.headers},contentType:result.contentType||'',bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyBase64:bytes.toString('base64'),originalBodyComplete:true})
   need(bytes.length>0&&bytes.length<=4*1024*1024&&totalBytes<=32*1024*1024,'empty or oversized original response')
   need(Number.isInteger(result.status)&&result.status===expectedStatus,'HTTP '+result.status+' at '+url)
   need(result.finalURL===url,'unexpected redirect or response identity')
   if(result.bodySHA256!==undefined)need(result.bodySHA256===sha(bytes),'original byte hash differs')
   const mime=kind==='pdf'?/^application\/pdf(?:;|$)/i:kind==='css'?/^text\/css(?:;|$)/i:kind==='json'?/^application\/json(?:;|$)/i:kind==='javascript'?/^(?:application|text)\/(?:x-)?javascript(?:;|$)/i:/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i
   need(mime.test(result.contentType||''),'original '+kind+' MIME differs')
   if(kind==='pdf'){need(bytes.subarray(0,5).toString()==='%PDF-','non-PDF native document');control.check();return{bytes,sha256:original.bodySHA256,headers:original.headers}}
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
 const observe=fn=>control.gate(async()=>{try{return await fn()}catch(error){
  if(options.signal?.aborted)throw options.signal.reason
  if(control.signal.aborted)throw control.signal.reason
  const wrapped=failure('observer failed');Object.defineProperty(wrapped,'cause',{value:error});throw wrapped
 }},observerMs,'observer')
 const decode=fn=>control.gate(async(checkPdf)=>{try{return await fn(checkPdf)}catch(error){if(options.signal?.aborted)throw options.signal.reason;if(control.signal.aborted)throw control.signal.reason;if(isFailure(error))throw error;const wrapped=failure('PDF decode failed');Object.defineProperty(wrapped,'cause',{value:error});throw wrapped}},pdfMs,'PDF decode')
 return{read,originals,control,decode,allow:url=>{control.check();allowed.add(url)},observe,attachFailure(error){if(!options.signal?.aborted&&isFailure(error)&&Object.isExtensible(error))Object.defineProperty(error,'nativeOriginalResponses',{value:structuredClone(originals)})}}
}
