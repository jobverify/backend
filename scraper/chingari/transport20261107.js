import {buildHttpError} from '../../scraper-support/utils/fetch.js'
import {types} from 'node:util'
import {bounded,failure,errorValue} from './runtime20261107.js'
export const MAX_BYTES=4000000
const typed=Object.getPrototypeOf(Uint8Array.prototype),get=name=>Object.getOwnPropertyDescriptor(typed,name).get
const length=get('byteLength'),offset=get('byteOffset'),buffer=get('buffer')
const diagnostic=error=>{const result={};for(const k of ['name','code','message']){let v;try{v=errorValue(error,k)}catch{}if(typeof v==='string')result[k]=v}return result}
export function nativeTransport({timeoutMs,onReceipt}){
 const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
 return async(url,init={})=>{
  let response,reader,packet,primaryFailure,released=false,bytes=0;const chunks=[]
  const release=()=>{if(reader&&!released){released=true;ignore(()=>reader.releaseLock())}}
  const cancel=()=>{if(reader){ignore(()=>reader.cancel());release()}else ignore(()=>response?.body?.cancel())}
  const retain=()=>{if(packet)onReceipt(packet,url)}
  const partial=error=>{
   if(packet&&!packet.bodyComplete){
    packet.rawBodyBase64=bytes?Buffer.concat(chunks,bytes).toString('base64'):null;packet.bodyBytes=bytes||null
    packet.bodyUnavailableReason??='Original entity acquisition did not complete'
    packet.acquisitionFailure=diagnostic(error)
   }
   retain()
  }
  try{return await bounded(async(signal,check)=>{
   const requestedAt=new Date().toISOString(),{expectedMime='html',...requestInit}=init
   response=await fetch(url,{...requestInit,method:'GET',redirect:'manual',credentials:'omit',signal})
   packet={url:response?.url??null,status:response?.status??null,headers:null,contentType:null,body:null,bodyComplete:false,bodyBytes:null,receivedBodyBytes:null,rawBodyBase64:null,requestedAt,headersObservedAt:new Date().toISOString(),completedAt:null}
   retain()
   if(response?.headers&&typeof response.headers.entries==='function'){packet.headers=Object.fromEntries(response.headers.entries());packet.contentType=response.headers.get('content-type')}
   retain()
   if(packet.url!==url||response.redirected===true||!Number.isInteger(packet.status)||packet.status<100||packet.status>599){
    primaryFailure=Object.assign(failure('Chingari response identity mismatch','CHINGARI_RESPONSE_IDENTITY'),{status:packet.status,requestUrl:url,finalUrl:packet.url,abortRetries:true})
   }else if(packet.status!==200){
    primaryFailure=buildHttpError(response,url)
    Object.assign(primaryFailure,{message:'Chingari HTTP '+packet.status+' for '+url,requestUrl:url,finalUrl:packet.url,abortRetries:true})
    if([202,401,403,429,451].includes(packet.status))Object.assign(primaryFailure,{failureKind:packet.status===202?'upstream_unavailable':'blocked_or_access_denied',softFailure:true,upstreamOutage:true})
   }else if(!packet.headers||!(expectedMime==='json'?/^application\/(?:[\w.+-]+\+)?json\b/i:/^text\/html\b/i).test(packet.contentType||'')){
    primaryFailure=failure('Chingari native response MIME unavailable','CHINGARI_NATIVE_PROOF')
   }
   const size=packet.headers?.['content-length']
   if(size!==undefined&&(!/^\d+$/.test(size)||Number(size)>MAX_BYTES))primaryFailure??=failure('Invalid or oversized Chingari entity length','CHINGARI_BODY_LIMIT')
   check()
   if(!response.body||typeof response.body.getReader!=='function')throw failure('Original Chingari streaming entity unavailable','CHINGARI_BODY_UNAVAILABLE')
   reader=response.body.getReader()
   for(;;){
    check();const {done,value}=await reader.read()
    if(done){
     const raw=Buffer.concat(chunks,bytes)
     Object.assign(packet,{bodyComplete:true,bodyBytes:bytes,receivedBodyBytes:bytes,rawBodyBase64:raw.toString('base64'),completedAt:new Date().toISOString()});retain();check()
     packet.body=new TextDecoder('utf-8',{fatal:true}).decode(raw);retain();check()
     if(primaryFailure)throw primaryFailure
     return packet
    }
    if(!types.isUint8Array(value))throw failure('Invalid Chingari stream chunk','CHINGARI_BODY_TYPE')
    const size=length.call(value);packet.receivedBodyBytes=bytes+size
    if(size>MAX_BYTES-bytes){
     const available=MAX_BYTES-bytes
     if(available){chunks.push(Buffer.from(new Uint8Array(buffer.call(value),offset.call(value),available)));bytes+=available}
     Object.assign(packet,{bodyBytes:bytes,rawBodyBase64:Buffer.concat(chunks,bytes).toString('base64'),bodyTruncated:true,bodyUnavailableReason:'Original entity exceeds4000000-byte acquisition limit'});retain()
     throw failure('Chingari response exceeds4000000 bytes','CHINGARI_BODY_LIMIT')
    }
    chunks.push(Buffer.from(new Uint8Array(buffer.call(value),offset.call(value),size)));bytes+=size
    packet.bodyBytes=bytes;packet.rawBodyBase64=Buffer.concat(chunks,bytes).toString('base64');retain();check()
   }
  },{signal:init.signal,timeoutMs,code:'CHINGARI_READ_TIMEOUT'})}
  catch(error){cancel();partial(error);if(init.signal?.aborted)throw init.signal.reason;throw primaryFailure??error}
  finally{release()}
 }
}
