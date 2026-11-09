import {buildHttpError} from '../../scraper-support/utils/fetch.js'
import {types} from 'node:util'
import {bounded,failure,errorValue,annotateFailure} from './runtime20261108.js'
export const MAX_BYTES=16777216
const typed=Object.getPrototypeOf(Uint8Array.prototype),get=name=>Object.getOwnPropertyDescriptor(typed,name).get
const length=get('byteLength'),offset=get('byteOffset'),buffer=get('buffer')
const diagnostic=error=>{const result={};for(const k of ['name','code','message']){let v;try{v=errorValue(error,k)}catch{}if(typeof v==='string')result[k]=v}return result}
export function nativeTransport({timeoutMs,onReceipt,fetchImpl=fetch,callerSignal}){
 const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
 return async(url,init={})=>{
  let response,reader,packet,primaryFailure,released=false,terminal=false,bytes=0;const chunks=[]
  const release=()=>{if(reader&&!released){released=true;ignore(()=>reader.releaseLock())}}
  const cancel=()=>{if(reader){ignore(()=>reader.cancel());release()}else ignore(()=>response?.body?.cancel())}
  const retain=()=>{if(packet&&!terminal)onReceipt(packet,url)}
  const partial=error=>{
   if(packet&&!packet.bodyComplete){
    packet.rawBodyBase64=bytes||packet.streamEOFObserved?Buffer.concat(chunks,bytes).toString('base64'):null;packet.bodyBytes=bytes||packet.streamEOFObserved?bytes:null
    packet.bodyUnavailableReason??='Original entity acquisition did not complete'
    packet.acquisitionFailure=diagnostic(error)
   }
   retain()
  }
  try{return await bounded(async(signal,check)=>{
   const requestedAt=new Date().toISOString(),{expectedMime='html',...requestInit}=init
   const incoming=await fetchImpl(url,{...requestInit,method:'GET',redirect:'manual',credentials:'omit',signal})
   // A producer may ignore AbortSignal. Its late body is cancelled without
   // publishing headers or mutating the terminal receipt/audit.
   try{check();if(terminal)throw failure('AXA acquisition already terminal','AXA_READ_TIMEOUT')}
   catch(error){ignore(()=>incoming?.body?.cancel());throw error}
   response=incoming
   packet={url:response?.url??null,status:response?.status??null,redirected:response?.redirected??null,identityValidated:false,acquisitionValidated:false,streamEOFObserved:false,headers:null,contentType:null,body:null,bodyComplete:false,bodyBytes:null,receivedBodyBytes:null,rawBodyBase64:null,requestedAt,headersObservedAt:new Date().toISOString(),completedAt:null}
   retain()
   if(response?.headers&&typeof response.headers.entries==='function'){packet.headers=Object.fromEntries(response.headers.entries());packet.contentType=response.headers.get('content-type')}
   retain()
   packet.identityValidated=packet.url===url&&packet.redirected===false&&Number.isInteger(packet.status)&&packet.status>=100&&packet.status<=599
   if(!packet.identityValidated||!Number.isInteger(packet.status)||packet.status<100||packet.status>599){
    primaryFailure=Object.assign(failure('AXA response identity mismatch','AXA_RESPONSE_IDENTITY'),{status:packet.status,requestUrl:url,finalUrl:packet.url,abortRetries:true})
   }else if(packet.status!==200&&!(expectedMime==='redirect'&&packet.status===302)){
    primaryFailure=buildHttpError(response,url)
    Object.assign(primaryFailure,{message:'AXA HTTP '+packet.status+' for '+url,requestUrl:url,finalUrl:packet.url,abortRetries:true})
    if([202,401,403,429,451].includes(packet.status))Object.assign(primaryFailure,{failureKind:packet.status===202?'upstream_unavailable':'blocked_or_access_denied',softFailure:true,upstreamOutage:true})
    else if(packet.status>=500)Object.assign(primaryFailure,{failureKind:'upstream_unavailable',softFailure:true,upstreamOutage:true})
   }else if(!packet.headers||!(expectedMime==='javascript'?['application/javascript','text/javascript','application/x-javascript']:expectedMime==='json'?['application/json']:expectedMime==='redirect'?['text/plain','text/html']:['text/html']).includes((packet.contentType??'').split(';',1)[0].trim().toLowerCase())){
    primaryFailure=failure('AXA native response MIME unavailable','AXA_NATIVE_PROOF')
   }
   const declaredSize=packet.headers?.['content-length']
   let entityFailure=declaredSize!==undefined&&(!/^\d+$/.test(declaredSize)||Number(declaredSize)>MAX_BYTES)?failure('Invalid or oversized AXA entity length','AXA_BODY_LIMIT'):null
   const encoding=(packet.headers?.['content-encoding']??'identity').trim().toLowerCase(),identityEntity=encoding===''||encoding==='identity'
   check()
   if(!response.body||typeof response.body.getReader!=='function')throw failure('Original AXA streaming entity unavailable','AXA_BODY_UNAVAILABLE')
   reader=response.body.getReader()
   for(;;){
    check();const {done,value}=await reader.read();check()
    if(done){
     const raw=Buffer.concat(chunks,bytes)
     if(!entityFailure&&declaredSize!==undefined&&identityEntity&&Number(declaredSize)!==bytes)entityFailure=failure('AXA entity length contradicts acquired identity bytes','AXA_BODY_LENGTH_MISMATCH')
     Object.assign(packet,{streamEOFObserved:true,bodyComplete:!entityFailure,bodyBytes:bytes,receivedBodyBytes:bytes,rawBodyBase64:raw.toString('base64'),completedAt:new Date().toISOString()});retain();check()
     if(entityFailure){try{packet.body=new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{}retain();throw entityFailure}
     if(expectedMime!=='gzip-script')packet.body=new TextDecoder('utf-8',{fatal:true}).decode(raw)
     else if(primaryFailure)try{packet.body=new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{}
     packet.acquisitionValidated=true;retain();check()
     if(primaryFailure)throw primaryFailure
     return packet
    }
    if(!types.isUint8Array(value))throw failure('Invalid AXA stream chunk','AXA_BODY_TYPE')
    const size=length.call(value);packet.receivedBodyBytes=bytes+size
    if(size>MAX_BYTES-bytes){
     const available=MAX_BYTES-bytes
     if(available){chunks.push(Buffer.from(new Uint8Array(buffer.call(value),offset.call(value),available)));bytes+=available}
     Object.assign(packet,{bodyBytes:bytes,rawBodyBase64:Buffer.concat(chunks,bytes).toString('base64'),bodyTruncated:true,bodyUnavailableReason:'Original entity exceeds16777216-byte acquisition limit'});retain()
     throw failure('AXA response exceeds16777216 bytes','AXA_BODY_LIMIT')
    }
    chunks.push(Buffer.from(new Uint8Array(buffer.call(value),offset.call(value),size)));bytes+=size
    packet.bodyBytes=bytes;packet.rawBodyBase64=Buffer.concat(chunks,bytes).toString('base64');retain();check()
   }
  },{signal:init.signal,timeoutMs,code:'AXA_READ_TIMEOUT'})}
  catch(error){
   partial(error);terminal=true;cancel()
   if(callerSignal?.aborted)throw callerSignal.reason
   if(primaryFailure)throw error===primaryFailure?primaryFailure:annotateFailure(primaryFailure,{acquisitionFailure:diagnostic(error)})
   if(init.signal?.aborted)throw init.signal.reason
   throw error
  }
  finally{terminal=true;release()}
 }
}
