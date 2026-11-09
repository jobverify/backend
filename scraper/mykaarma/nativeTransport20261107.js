import {createHash} from 'node:crypto'
export const REQUEST_HEADERS=Object.freeze({'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'})
export const nativeError=(message,extra={})=>Object.assign(Error('MyKaarma native: '+message),{source:'mykaarma',failureKind:'parser_or_contract_error',softFailure:false,upstreamOutage:false,abortRetries:true,...extra})
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const describe=e=>{try{const v=Object.getOwnPropertyDescriptor(e??{},'message')?.value;return typeof v==='string'?v:'Opaque public read failure'}catch{return 'Opaque public read failure'}}
export function createPublicReader(options,audit,allowed){
 const limit=(key,fallback)=>{const v=options[key]??fallback;if(!Number.isSafeInteger(v)||v<1||v>fallback)throw nativeError('Invalid reduced '+key+' bound');return v}
 const bounds={sourceTimeoutMs:limit('sourceTimeoutMs',90000),requestTimeoutMs:limit('requestTimeoutMs',15000),maxResponseBytes:limit('maxResponseBytes',3000000),maxTotalBytes:limit('maxTotalBytes',32000000),maxRequests:limit('maxRequests',96)}
 if(options.maxJobs!=null)throw nativeError('Native truncation forbidden')
 if(options.signal!==undefined&&!(options.signal instanceof AbortSignal))throw nativeError('Invalid caller signal')
 for(const k of ['fetchImpl','fetchText','onAudit'])if(options[k]!==undefined&&typeof options[k]!=='function')throw nativeError('Invalid '+k)
 const caller=options.signal;caller?.throwIfAborted()
 audit.bounds=bounds;audit.clocks=[];let bytes=0
 const clock=()=>{const v=typeof options.now==='function'?options.now():options.now??new Date().toISOString();if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw nativeError('Invalid collection clock');audit.clocks.push(v);return v}
 audit.startedAt=clock();const controller=new AbortController(),start=performance.now(),timeout=n=>nativeError(n+' deadline exceeded',{failureKind:'network_or_timeout',softFailure:true,upstreamOutage:true}),sourceTimer=setTimeout(()=>controller.abort(timeout('Source')),bounds.sourceTimeoutMs)
 const sourceSignal=AbortSignal.any([controller.signal,...caller?[caller]:[]])
 const check=()=>{caller?.throwIfAborted();if(!controller.signal.aborted&&performance.now()-start>=bounds.sourceTimeoutMs)controller.abort(timeout('Source'));sourceSignal.throwIfAborted()}
 const race=(operation,signal,dispose,checkOperation=check)=>new Promise((resolve,reject)=>{let settled=false;const clean=()=>signal.removeEventListener('abort',abort),abort=()=>{if(!settled){settled=true;clean();reject(signal.reason)}};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
  Promise.resolve().then(()=>{checkOperation();signal.throwIfAborted();return operation()}).then(value=>{if(settled){if(dispose)ignore(()=>dispose(value));return}if(signal.aborted){abort();if(dispose)ignore(()=>dispose(value));return}try{checkOperation()}catch(e){settled=true;clean();reject(e);if(dispose)ignore(()=>dispose(value));return}settled=true;clean();resolve(value)},error=>{if(settled)return;settled=true;clean();reject(caller?.aborted?caller.reason:signal.aborted?signal.reason:error)})})
 const cancelBody=response=>ignore(()=>response?.body?.cancel()),cancelReader=reader=>{ignore(()=>reader.cancel());ignore(()=>reader.releaseLock())}
 async function read(url,kind='html'){
  check();if(!allowed.has(url))throw nativeError('Undeclared public URL');if(audit.responses.length>=bounds.maxRequests)throw nativeError('Native request bound exceeded')
  const row={sequence:audit.responses.length+1,requestedURL:url,method:'GET',redirect:'manual',credentials:'omit',requestHeaders:{...REQUEST_HEADERS},requestedAt:clock(),completedAt:null,status:null,finalURL:null,contentType:null,bodyComplete:false,bodyBytes:null,bodySHA256:null,bodyBase64:null};audit.responses.push(row)
  const requestStart=performance.now(),request=new AbortController(),timer=setTimeout(()=>request.abort(timeout('Request')),bounds.requestTimeoutMs),signal=AbortSignal.any([sourceSignal,request.signal]);let response,reader,httpError,finished=false
  const requestCheck=()=>{check();if(!request.signal.aborted&&performance.now()-requestStart>=bounds.requestTimeoutMs)request.abort(timeout('Request'));signal.throwIfAborted()}
  try{
   if(options.fetchText&&!options.fetchImpl){const text=await race(()=>options.fetchText(url,{method:'GET',redirect:'manual',credentials:'omit',signal,headers:{...REQUEST_HEADERS}}),signal,undefined,requestCheck);if(typeof text!=='string'||Buffer.byteLength(text)>bounds.maxResponseBytes)throw nativeError('Invalid decoded-only body');audit.issues.push({kind:'unqualified-decoded-only-transport',url});return{body:text,qualified:false}}
   response=await race(()=>(options.fetchImpl??globalThis.fetch)(url,{method:'GET',redirect:'manual',credentials:'omit',signal,headers:{...REQUEST_HEADERS}}),signal,cancelBody,requestCheck)
   row.status=response.status;row.finalURL=response.url;row.contentType=response.headers?.get('content-type')??null
   if(Number.isInteger(row.status)&&row.status>=100&&row.status<=599&&row.status!==200){const denied=[401,403,406,429,451].includes(row.status);httpError=nativeError('Public HTTP '+row.status,{status:row.status,httpStatus:row.status,requestURL:url,finalURL:row.finalURL,failureKind:denied?'blocked_or_access_denied':row.status>=500?'network_or_timeout':'surface_drift_or_fail_closed',softFailure:true,upstreamOutage:denied||row.status>=500})}
   try{
    if(!response.body?.getReader)throw nativeError('Original readable response body unavailable')
    reader=await race(()=>response.body.getReader(),signal,cancelReader,requestCheck);const chunks=[];let size=0
    for(;;){const part=await race(()=>reader.read(),signal,undefined,requestCheck);requestCheck();signal.throwIfAborted();if(part.done)break;if(!(part.value instanceof Uint8Array))throw nativeError('Original body chunk is not bytes');size+=part.value.byteLength;if(size>bounds.maxResponseBytes||bytes+size>bounds.maxTotalBytes)throw nativeError('Original response byte bound exceeded');chunks.push(Buffer.from(part.value));row.bodyPrefixBytes=size;row.bodyPrefixSHA256=createHash('sha256').update(Buffer.concat(chunks,size)).digest('hex')}
    const body=Buffer.concat(chunks,size);bytes+=size;audit.decodedBytes=bytes;Object.assign(row,{bodyBytes:size,bodySHA256:createHash('sha256').update(body).digest('hex'),bodyBase64:body.toString('base64'),bodyComplete:true});finished=true
   }catch(error){caller?.throwIfAborted();if(!httpError)throw error;Object.defineProperty(httpError,'cause',{value:error});Object.defineProperty(httpError,'bodyReadError',{value:error});audit.issues.push({kind:'denied-entity-incomplete',url,message:describe(error)})}
   if(httpError)throw httpError
   if(row.status!==200||row.finalURL!==url)throw nativeError('Original HTTP status or URL identity changed')
   if(!(kind==='javascript'?/(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i:/^text\/html(?:\s*;|$)/i).test(row.contentType??''))throw nativeError('Original response MIME changed')
   const body=new TextDecoder('utf8',{fatal:true}).decode(Buffer.from(row.bodyBase64,'base64'));if(!body.trim())throw nativeError('Empty original public body');return{body,qualified:true}
  }catch(error){caller?.throwIfAborted();throw error}finally{clearTimeout(timer);if(reader){if(!finished)cancelReader(reader);else ignore(()=>reader.releaseLock())}else if(response)cancelBody(response);try{row.completedAt=clock()}catch(error){audit.issues.push({kind:'completion-clock-unavailable',message:describe(error)})}}
 }
 return{read,clock,check,now:audit.startedAt,close:()=>clearTimeout(sourceTimer),async deliver(){if(!options.onAudit)return;check();await race(()=>options.onAudit(structuredClone(audit)),sourceSignal)},caller}
}
