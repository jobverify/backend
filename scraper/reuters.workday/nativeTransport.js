import {createHash} from 'node:crypto'
import {types} from 'node:util'

const DEFAULTS=Object.freeze({sourceTimeoutMs:90000,requestTimeoutMs:15000,maxRequests:48,responseBytes:4000000,aggregateBytes:32*1024*1024})
const DENIED=new Set([401,403,406,429,451])
const MIME={html:/^text\/html(?:;|$)/i,json:/^application\/json(?:;|$)/i,javascript:/^(?:application|text)\/(?:javascript|ecmascript)(?:;|$)/i}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const prototype=Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic=name=>Object.getOwnPropertyDescriptor(prototype,name).get
const lengthOf=intrinsic('byteLength'),offsetOf=intrinsic('byteOffset'),bufferOf=intrinsic('buffer')
const quiet=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
const fault=(message,extra={})=>Object.assign(Error('[reuters] '+message),{
 source:'reuters',failureKind:'coverage_gap',softFailure:true,upstreamOutage:false,abortRetries:true,...extra,
})
const requireValue=(value,message)=>{if(!value)throw fault(message)}
const httpsURL=value=>{
 requireValue(typeof value==='string','URL grant must be a string')
 const parsed=new URL(value)
 requireValue(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.hash&&parsed.href===value,'Unreviewed URL grant authority')
 return value
}

function wait(operation,signal,check,late){
 return new Promise((resolve,reject)=>{
  let settled=false,reason
  const detach=()=>signal.removeEventListener('abort',abort)
  const fail=error=>{if(settled)return;settled=true;reason=error;detach();reject(error)}
  const abort=()=>fail(signal.reason)
  signal.addEventListener('abort',abort,{once:true})
  try{check()}catch(error){fail(error);return}
  Promise.resolve().then(()=>{check();return operation()}).then(value=>{
   if(settled){if(late)quiet(()=>late(value,reason));return}
   try{check()}catch(error){fail(error);if(late)quiet(()=>late(value,error));return}
   settled=true;detach();resolve(value)
  },error=>{if(settled)return;try{check()}catch(expired){error=expired}fail(error)})
 })
}

export function createReutersReader(options={}){
 const limits=Object.fromEntries(Object.entries(DEFAULTS).map(([key,maximum])=>{
  const value=options[key]??maximum
  requireValue(Number.isSafeInteger(value)&&value>0&&value<=maximum,'Invalid '+key+' bound')
  return[key,value]
 }))
 const caller=options.signal
 requireValue(caller==null||caller instanceof AbortSignal,'Caller signal must be an AbortSignal')
 caller?.throwIfAborted()
 const fetchImpl=options.fetchImpl??globalThis.fetch
 requireValue(typeof fetchImpl==='function','Missing public response transport')
 const controller=new AbortController(),deadline=performance.now()+limits.sourceTimeoutMs
 const sourceReason=new DOMException('Reuters source deadline exceeded','TimeoutError')
 const signal=AbortSignal.any([controller.signal,...(caller?[caller]:[])])
 const timer=setTimeout(()=>controller.abort(sourceReason),limits.sourceTimeoutMs)
 const receipts=[],grants=new Map(),cancelled=new WeakSet(),released=new WeakSet()
 let closed=false,halted=false,terminal,totalBytes=0,inFlight=false
 const release=reader=>{if(!reader||released.has(reader))return;released.add(reader);quiet(()=>reader.releaseLock())}
 const cancelReader=(reader,reason)=>{if(!reader||cancelled.has(reader))return;cancelled.add(reader);quiet(()=>reader.cancel(reason));release(reader)}
 const cancelResponse=(response,reason)=>quiet(()=>{
  const body=response?.body;if(!body||cancelled.has(body))return;cancelled.add(body);return body.cancel(reason)
 })
 const check=()=>{
  caller?.throwIfAborted()
  if(halted)throw terminal
  requireValue(!closed,'Native reader is closed')
  if(!controller.signal.aborted&&performance.now()>=deadline)controller.abort(sourceReason)
  signal.throwIfAborted()
 }
 const grant=(url,{method='GET',finalURL=url,mime,redirect='follow',authorityBasis=null}={})=>{
  check();httpsURL(url);httpsURL(finalURL)
  requireValue(['GET','POST'].includes(method)&&Object.hasOwn(MIME,mime),'Unreviewed URL grant method or MIME')
  requireValue(['follow','error'].includes(redirect),'Unreviewed native redirect policy')
  const key=method+' '+url,value={method,finalURL,mime,redirect,authorityBasis}
  if(grants.has(key))requireValue(JSON.stringify(grants.get(key))===JSON.stringify(value),'Changed native URL grant authority')
  else{requireValue(grants.size<DEFAULTS.maxRequests,'URL grant bound exceeded');grants.set(key,value)}
 }
 const close=()=>{
  if(closed)return
  closed=true;clearTimeout(timer)
  if(!controller.signal.aborted)controller.abort(fault('Native reader is closed'))
 }
 const read=async(url,{method='GET',body}={})=>{
  check()
  const declaration=grants.get(method+' '+url)
  requireValue(declaration,'No declared native URL/method grant')
  requireValue(method!=='GET'||body===undefined,'GET body is not permitted')
  requireValue(method!=='POST'||typeof body==='string'&&body.length>0&&Buffer.byteLength(body)<=65536,'POST body must be bounded original JSON text')
  requireValue(!inFlight,'Concurrent native reads are not permitted')
  requireValue(receipts.length<limits.maxRequests,'Native request bound exceeded')
  const headers={accept:declaration.mime==='json'?'application/json':'text/html','user-agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}
  if(method==='POST')headers['content-type']='application/json'
  const request=new AbortController(),requestDeadline=performance.now()+limits.requestTimeoutMs
  const requestReason=new DOMException('Reuters request deadline exceeded','TimeoutError')
  const requestSignal=AbortSignal.any([signal,request.signal])
  const requestTimer=setTimeout(()=>request.abort(requestReason),limits.requestTimeoutMs)
  const checkRequest=()=>{
   caller?.throwIfAborted()
   const now=performance.now()
   if(deadline<=requestDeadline&&now>=deadline&&!controller.signal.aborted)controller.abort(sourceReason)
   if(now>=requestDeadline&&!request.signal.aborted)request.abort(requestReason)
   check();requestSignal.throwIfAborted()
  }
  const receipt={sequence:receipts.length+1,requestedURL:url,url,method,redirect:declaration.redirect,credentials:'omit',
   requestHeaders:{...headers},requestBodySHA256:sha(body??''),requestBodyBytes:Buffer.byteLength(body??''),
   requestBodyBase64:Buffer.from(body??'').toString('base64'),authorityBasis:declaration.authorityBasis,
   startedAt:new Date().toISOString(),completedAt:null,status:null,contentType:null,
   bodyUnavailable:true,bodyBytes:null,bodySHA256:null}
  receipts.push(receipt);inFlight=true
  let response,reader
  const pending=(operation,late)=>wait(operation,requestSignal,checkRequest,late)
  try{
   const init={method,headers,signal:requestSignal,redirect:declaration.redirect,credentials:'omit',...(method==='POST'?{body}:{})}
   response=await pending(()=>fetchImpl(url,init),cancelResponse)
   const observedStatus=response.status;receipt.url=response.url
   if(!Number.isSafeInteger(observedStatus)||observedStatus<100||observedStatus>599){
    receipt.observedInvalidStatus=observedStatus
    throw fault('Invalid native HTTP status')
   }
   receipt.status=observedStatus
   receipt.headers=Object.fromEntries([...response.headers].filter(([key])=>key.toLowerCase()!=='set-cookie'))
   receipt.contentType=response.headers.get('content-type')??''
   requireValue(receipt.url===declaration.finalURL,'Unexpected final native URL authority')
   requireValue(MIME[declaration.mime].test(receipt.contentType),'Unexpected native response MIME')
   const byteLimit=Math.min(limits.responseBytes,limits.aggregateBytes-totalBytes)
   requireValue(byteLimit>0,'Aggregate response byte bound exceeded')
   const declared=response.headers.get('content-length')
   requireValue(declared==null||/^\d+$/.test(declared)&&Number(declared)<=byteLimit,'Declared response byte limit exceeded')
   requireValue(response.body&&typeof response.body.getReader==='function','Original native response body unavailable')
   reader=await pending(()=>response.body.getReader(),cancelReader)
   const chunks=[];let size=0
   for(;;){
    const part=await pending(()=>reader.read());checkRequest()
    if(part.done)break
    requireValue(types.isUint8Array(part.value),'Native response chunk must contain original bytes')
    const length=lengthOf.call(part.value)
    requireValue(length<=byteLimit-size,'Streamed response byte limit exceeded')
    chunks.push(Buffer.from(new Uint8Array(bufferOf.call(part.value),offsetOf.call(part.value),length)));size+=length;checkRequest()
   }
   const bytes=Buffer.concat(chunks,size);checkRequest();totalBytes+=size
   receipt.bodyBytes=size;receipt.bodySHA256=sha(bytes);receipt.bodyUnavailable=false
   let html
   try{html=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}
   catch(error){receipt.originalBodyBase64=bytes.toString('base64');throw fault('Invalid original UTF8 response',{cause:error,failureKind:'parser_or_contract_error'})}
   requireValue(Buffer.from(html).equals(bytes),'Native text decoding changed original UTF8 bytes')
   receipt.body=html;checkRequest()
   if(receipt.status!==200)throw fault('Public source HTTP '+receipt.status,{
    status:receipt.status,statusCode:receipt.status,requestUrl:url,
    failureKind:DENIED.has(receipt.status)?'blocked_or_access_denied':receipt.status>=500?'upstream_unavailable':'coverage_gap',
    upstreamOutage:DENIED.has(receipt.status)||receipt.status>=500,
   })
   return{status:receipt.status,url:receipt.url,contentType:receipt.contentType,html,bodySHA256:receipt.bodySHA256,bodyBytes:size}
  }catch(error){
   if(reader)cancelReader(reader,error);else cancelResponse(response,error)
   let primary
   if(caller?.aborted)primary=caller.reason
   else if(receipt.status!=null&&receipt.status!==200){
    primary=error?.status===receipt.status&&error?.requestUrl===url?error:fault('Public source HTTP '+receipt.status+'; collection failed',{
     cause:error,status:receipt.status,statusCode:receipt.status,requestUrl:url,
     failureKind:DENIED.has(receipt.status)?'blocked_or_access_denied':receipt.status>=500?'upstream_unavailable':'coverage_gap',
     upstreamOutage:DENIED.has(receipt.status)||receipt.status>=500,
    })
   }else if(error===sourceReason||error===requestReason){
    primary=Object.assign(error,{source:'reuters',requestUrl:url,failureKind:'network_or_timeout',softFailure:true,upstreamOutage:true,abortRetries:true})
   }else if(error?.source==='reuters')primary=error
   else primary=fault('Original public response failed',{cause:error,requestUrl:url,failureKind:'network_or_timeout',upstreamOutage:true})
   if(!(caller?.aborted)&&primary&&typeof primary==='object'){
    if(primary.requestUrl==null)primary.requestUrl=url
    primary.nativeHttpReceipt=receipt
   }
   receipt.failureMessage=caller?.aborted?'Caller cancelled native request':error instanceof Error?error.message:String(error)
   halted=true;terminal=primary;throw primary
  }finally{
   clearTimeout(requestTimer);release(reader);receipt.completedAt=new Date().toISOString();inFlight=false
  }
 }
 return{receipts,signal,check,grant,read,close,dispose:close}
}
