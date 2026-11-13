import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'

const limit=4000000
function pendingWithSignal(work,signal,onLateValue){
 signal.throwIfAborted()
 return new Promise((resolve,reject)=>{
  let settled=false
  const abort=()=>{if(!settled){settled=true;reject(signal.reason)}}
  signal.addEventListener('abort',abort,{once:true})
  Promise.resolve().then(()=>{signal.throwIfAborted();return work()}).then(value=>{
   if(settled){onLateValue?.(value);return}
   settled=true;signal.removeEventListener('abort',abort);resolve(value)
  },error=>{if(!settled){settled=true;signal.removeEventListener('abort',abort);reject(error)}})
 })
}
const cancel=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{})}catch{/* An uncooperative transport cannot defer cancellation. */}}
export function createPublicReader(options,receipts){
 return async(url,init={})=>{
  options.signal?.throwIfAborted()
  const startedAt=new Date().toISOString(),controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(Error('comviva native public read timeout')),15000)
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
  let acquiredBody
  try{
   let bytes,status=200,finalURL=url
   const request={...init,signal,redirect:'manual'}
   if(options.fetchText){
    const value=await pendingWithSignal(()=>options.fetchText(url,request),signal)
    if(typeof value!=='string')throw Error('comviva native public reader requires original text')
    bytes=Buffer.from(value)
   }else{
    const response=await pendingWithSignal(()=>(options.fetchImpl||fetch)(url,request),signal,response=>cancel(response?.body))
    acquiredBody=response.body
    status=response.status;finalURL=response.url||url
    if(status!==200||finalURL!==url){cancel(response.body);throw Object.assign(Error('comviva native public response status or final URL changed: '+status+' '+finalURL),{status})}
    const type=response.headers.get('content-type')||''
    if(!/^(?:text\/(?:html|css|javascript)|application\/(?:json|javascript|x-javascript))/i.test(type)){cancel(response.body);throw Error('comviva native public response type changed')}
    if(response.body?.getReader){
     const reader=response.body.getReader(),chunks=[];let count=0
     try{while(true){signal.throwIfAborted();const part=await pendingWithSignal(()=>reader.read(),signal);signal.throwIfAborted();if(part.done)break;count+=part.value.length;if(count>limit)throw Error('comviva native response byte budget exceeded');chunks.push(Buffer.from(part.value))}bytes=Buffer.concat(chunks)}
     finally{cancel(reader);try{reader.releaseLock()}catch{/* A pending cancelled read may still own the lock. */}}
    }else bytes=Buffer.from(await pendingWithSignal(()=>response.arrayBuffer(),signal,()=>cancel(response.body)))
   }
   signal.throwIfAborted()
   if(bytes.length>limit)throw Error('comviva native response byte budget exceeded')
   // Native production fetch normally decompresses. Retained public transports
   // can expose a wire gzip body; the magic bytes prevent double decoding.
   if(bytes[0]===0x1f&&bytes[1]===0x8b)bytes=gunzipSync(bytes,{maxOutputLength:limit})
   if(bytes.length>limit)throw Error('comviva native decoded byte budget exceeded')
   receipts.push({url,method:init.method||'GET',status,finalURL,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),startedAt,completedAt:new Date().toISOString()})
   return bytes.toString('utf8')
  }catch(error){options.signal?.throwIfAborted();receipts.push({url,method:init.method||'GET',startedAt,completedAt:new Date().toISOString(),failed:true,error:String(error.message||error)});throw error}
  finally{clearTimeout(timeout);cancel(acquiredBody)}
 }
}
