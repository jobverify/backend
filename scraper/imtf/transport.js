import {types} from 'node:util'
import {boundedOperation,runtimeError} from './runtime.js'
import {HOME,CAREERS,roleCode,markdownCode} from './parser.js'
import {LLM_INDEX,BOARD_INDEX,ownJSONCode} from './currentBoard.js'
export const MAX_BYTES=2*1024*1024
export const TIMEOUT_MS=20000
export function validateURL(url,advertised=[HOME,CAREERS]){if(typeof url!=='string'||!advertised.includes(url)||!(url===HOME||url===CAREERS||roleCode(url)||markdownCode(url)||url===LLM_INDEX||url===BOARD_INDEX||ownJSONCode(url)))throw Object.assign(Error('Unadvertised or disallowed IMTF read URL'),{code:'IMTF_URL_DISALLOWED'});return url}
export function redirectURL(current,location){if(typeof location!=='string'||!location||location!==location.trim()||/[\\\r\n\t]/.test(location))throw Error('Invalid redirect location');const target=/^[A-Za-z][A-Za-z0-9+.-]*:/.test(location)?location:new URL(location,current).href;const same=roleCode(current)?roleCode(target)===roleCode(current):markdownCode(current)?target===current:target===current;if(!same)throw Error('Redirect changes permitted source/role identity');validateURL(target,[target]);return target}
export function createNativeTransport({fetchImpl=globalThis.fetch,signal,timeoutMs=TIMEOUT_MS,onReceipt}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>TIMEOUT_MS)throw Error('Invalid bounded timeout')
 if(typeof fetchImpl!=='function'||onReceipt!==undefined&&typeof onReceipt!=='function')throw runtimeError('Invalid IMTF transport callback','IMTF_INVALID_OPTIONS')
 const typed=Object.getPrototypeOf(Uint8Array.prototype),get=name=>Object.getOwnPropertyDescriptor(typed,name).get
 const byteLength=get('byteLength'),byteOffset=get('byteOffset'),arrayBuffer=get('buffer')
 const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
 return async(url,{advertised=[HOME,CAREERS],signal:readSignal,headers:readHeaders={}}={})=>{
  validateURL(url,advertised)
  const caller=signal&&readSignal?AbortSignal.any([signal,readSignal]):signal??readSignal
  caller?.throwIfAborted()
  let response,reader,released=false,packet,bytes=0
  const chunks=[]
  const release=()=>{if(reader&&!released){released=true;ignore(()=>reader.releaseLock())}}
  const cancel=()=>{if(reader){ignore(()=>reader.cancel());release()}else ignore(()=>response?.body?.cancel())}
  try{return await boundedOperation(async(combined,check)=>{
   const requestedAt=new Date().toISOString()
   response=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html, application/json, text/markdown',...readHeaders},signal:combined})
   packet={requestedURL:url,url:response?.url??null,status:response?.status??null,headers:null,body:null,bodyComplete:false,requestedAt,completedAt:null,headersObservedAt:new Date().toISOString()}
   onReceipt?.(packet)
   if(response?.headers&&typeof response.headers.entries==='function')packet.headers=Object.fromEntries(response.headers.entries())
   onReceipt?.(packet)
   try{check()}catch(error){cancel();throw error}
   if(response?.url!==url||response.redirected===true||!Number.isInteger(response.status)||response.status<100||response.status>599||!packet.headers)throw Error('Invalid manual streaming response identity')
   const headers=packet.headers
   if(response.status!==200){packet.bodyUnavailableReason='Non-success entity not acquired';cancel();onReceipt?.(packet);return packet}
   const length=headers['content-length']
   if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))throw Error('Invalid/oversized advertised content length')
   if(!response.body||typeof response.body.getReader!=='function')throw Error('Original streaming body unavailable')
   reader=response.body.getReader()
   for(;;){
    check();const {done,value}=await reader.read()
    if(done){Object.assign(packet,{body:Buffer.concat(chunks,bytes),receivedBodyBytes:bytes,bodyComplete:true,completedAt:new Date().toISOString()});onReceipt?.(packet);check();break}
    if(!types.isUint8Array(value))throw Error('Invalid stream chunk')
    const size=byteLength.call(value)
    packet.receivedBodyBytes=bytes+size
    if(size>MAX_BYTES-bytes)throw Object.assign(Error('IMTF response exceeds 2MiB streaming limit'),{code:'IMTF_BODY_LIMIT'})
    chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value),byteOffset.call(value),size)));bytes+=size
    packet.body=Buffer.concat(chunks,bytes);onReceipt?.(packet);check()
   }
   return packet
  },{signal:caller,timeoutMs,code:'ETIMEDOUT'})}
  catch(error){
   cancel()
   if(packet){if(!packet.bodyComplete)Object.assign(packet,{body:bytes?Buffer.concat(chunks,bytes):null,bodyUnavailableReason:'Original entity acquisition did not complete'});onReceipt?.(packet)}
   throw error
  }finally{release()}
 }
}
