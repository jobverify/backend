import {types} from 'node:util'
import {bounded,failure} from './nativeRuntime20261107.js'
export const MAX_BYTES=8*1024*1024
const typed=Object.getPrototypeOf(Uint8Array.prototype),get=name=>Object.getOwnPropertyDescriptor(typed,name).get
const length=get('byteLength'),offset=get('byteOffset'),buffer=get('buffer')
export function nativeTransport({timeoutMs,onReceipt}){
 const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
 return async(url,init)=>{
  let response,reader,packet,released=false,bytes=0;const chunks=[]
  const release=()=>{if(reader&&!released){released=true;ignore(()=>reader.releaseLock())}}
  const cancel=()=>{if(reader){ignore(()=>reader.cancel());release()}else ignore(()=>response?.body?.cancel())}
  const retain=()=>{if(packet)onReceipt(packet,url)}
  const partial=()=>{if(packet&&!packet.bodyComplete){packet.rawBodyBase64=bytes?Buffer.concat(chunks,bytes).toString('base64'):null;packet.bodyBytes=bytes||null;packet.bodyUnavailableReason='Original entity acquisition did not complete'};retain()}
  try{return await bounded(async(signal,check)=>{
   const requestedAt=new Date().toISOString()
   response=await fetch(url,{...init,method:'GET',redirect:'manual',credentials:'omit',signal})
   packet={url:response?.url??null,status:response?.status??null,headers:null,contentType:null,body:null,bodyComplete:false,bodyBytes:null,receivedBodyBytes:null,rawBodyBase64:null,requestedAt,headersObservedAt:new Date().toISOString(),completedAt:null}
   retain()
   try{
    if(response?.headers&&typeof response.headers.entries==='function'){packet.headers=Object.fromEntries(response.headers.entries());packet.contentType=response.headers.get('content-type')}
    retain();check()
    if(packet.url!==url||response.redirected===true||!Number.isInteger(packet.status)||packet.status<100||packet.status>599||!packet.headers)throw failure('Invalid Snowplow manual response identity','SNOWPLOW_RESPONSE_IDENTITY')
    if(packet.status!==200){packet.bodyUnavailableReason='Non-success entity not acquired';cancel();retain();return packet}
    const size=packet.headers['content-length'];if(size!==undefined&&(!/^\d+$/.test(size)||Number(size)>MAX_BYTES))throw failure('Invalid or oversized Snowplow entity length','SNOWPLOW_BODY_LIMIT')
    if(!response.body||typeof response.body.getReader!=='function')throw failure('Original Snowplow streaming entity unavailable','SNOWPLOW_BODY_UNAVAILABLE')
    reader=response.body.getReader()
    for(;;){
     check();const {done,value}=await reader.read()
     if(done){const raw=Buffer.concat(chunks,bytes);Object.assign(packet,{bodyComplete:true,bodyBytes:bytes,receivedBodyBytes:bytes,rawBodyBase64:raw.toString('base64'),completedAt:new Date().toISOString()});retain();check();packet.body=new TextDecoder('utf-8',{fatal:true}).decode(raw);retain();check();return packet}
     if(!types.isUint8Array(value))throw failure('Invalid Snowplow stream chunk','SNOWPLOW_BODY_TYPE')
     const size=length.call(value);packet.receivedBodyBytes=bytes+size
     if(size>MAX_BYTES-bytes){
      const available=MAX_BYTES-bytes
      if(available){chunks.push(Buffer.from(new Uint8Array(buffer.call(value),offset.call(value),available)));bytes+=available}
      Object.assign(packet,{bodyBytes:bytes,rawBodyBase64:Buffer.concat(chunks,bytes).toString('base64'),bodyTruncated:true});retain()
      throw failure('Snowplow response exceeds8MiB','SNOWPLOW_BODY_LIMIT')
     }
     chunks.push(Buffer.from(new Uint8Array(buffer.call(value),offset.call(value),size)));bytes+=size
     packet.bodyBytes=bytes;packet.rawBodyBase64=Buffer.concat(chunks,bytes).toString('base64');retain();check()
    }
   }catch(error){cancel();partial();throw error}
  },{signal:init.signal,timeoutMs,code:'SNOWPLOW_READ_TIMEOUT'})}
  catch(error){cancel();partial();throw error}
  finally{release()}
 }
}
