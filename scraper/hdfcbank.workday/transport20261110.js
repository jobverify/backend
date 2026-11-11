import {setTimeout as delay} from 'node:timers/promises'
import {need,sha} from './profile20261110.js'

const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
export const abortable=(start,signal,late)=>new Promise((resolve,reject)=>{
 let ended=false
 const finish=(fn,value)=>{if(ended)return;ended=true;signal.removeEventListener('abort',abort);fn(value)}
 const abort=()=>finish(reject,signal.reason)
 signal.addEventListener('abort',abort,{once:true})
 Promise.resolve().then(()=>{signal.throwIfAborted();return start()}).then(value=>{
  if(ended){ignore(()=>late?.(value));return}
  signal.aborted?abort():finish(resolve,value)
 },error=>finish(reject,error))
 if(signal.aborted)abort()
})
const integer=(value,name,max)=>{need(Number.isSafeInteger(value)&&value>0&&value<=max,'invalid '+name);return value}
export function createHdfcTransport(options,allowedURL){
 options.signal?.throwIfAborted()
 const settings={maxRequests:integer(options.maxRequests??72,'maxRequests',128),
  sourceTimeoutMs:integer(options.sourceTimeoutMs??180000,'sourceTimeoutMs',180000),
  requestTimeoutMs:integer(options.requestTimeoutMs??20000,'requestTimeoutMs',30000),
  maxResponseBytes:integer(options.maxResponseBytes??4000000,'maxResponseBytes',8000000),
  maxTotalBytes:integer(options.maxTotalBytes??16000000,'maxTotalBytes',32000000)}
 const interval=options.requestIntervalMs??250
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000
  &&(interval>=250||options.fetchImpl&&options.fetchImpl!==globalThis.fetch),'invalid request interval')
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'original native HTTP fetchImpl responses required')
 need(options.fetchImpl===undefined||typeof options.fetchImpl==='function','invalid fetchImpl')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const timeout=Object.assign(Error('HDFC native source deadline exceeded'),{code:'HDFC_SOURCE_TIMEOUT',softFailure:true,abortRetries:true})
 const sourceDeadline=performance.now()+settings.sourceTimeoutMs
 const timer=setTimeout(()=>controller.abort(timeout),settings.sourceTimeoutMs),receipts=[],nextStart=new Map()
 let count=0,totalBytes=0,closed=false
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()>=sourceDeadline&&!controller.signal.aborted)controller.abort(timeout);signal.throwIfAborted();need(!closed,'source acquisition already terminal')}
 const read=async(url,{method='GET',body=null,kind='html',phase='opening',expectedStatus=200}={})=>{
  check();const parsed=new URL(url)
  need(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.port&&!parsed.hash
   &&allowedURL(url,method,body),'unbound native request')
  need(count<settings.maxRequests,'native request budget reached');count++
  const at=Math.max(Date.now(),nextStart.get(parsed.origin)||0);nextStart.set(parsed.origin,at+interval)
  if(at>Date.now())await delay(at-Date.now(),undefined,{signal})
  check()
  const requestController=new AbortController(),requestDeadline=performance.now()+settings.requestTimeoutMs
  const requestSignal=AbortSignal.any([signal,requestController.signal,AbortSignal.timeout(settings.requestTimeoutMs)])
  const requestCheck=()=>{
   check()
   if(performance.now()>=requestDeadline&&!requestController.signal.aborted)requestController.abort(new DOMException('HDFC native request deadline exceeded','TimeoutError'))
   requestSignal.throwIfAborted()
  }
  const packet={requestedURL:url,method,requestBody:body,phase,requestedAt:new Date().toISOString(),headersObservedAt:null,
   completedAt:null,finalURL:null,status:null,headers:null,bodyComplete:false,receivedBodyBytes:0,bodyBytes:0,rawBodyBase64:null,body:null}
  receipts.push(packet)
  let response,reader,primary=null,released=false;const chunks=[]
  const release=()=>{if(reader&&!released){released=true;ignore(()=>reader.releaseLock())}}
  const cancel=()=>{if(reader){ignore(()=>reader.cancel(requestSignal.reason));release()}else ignore(()=>response?.body?.cancel(requestSignal.reason))}
  try{
   response=await abortable(()=> (options.fetchImpl||globalThis.fetch)(url,{method,...(body!==null?{body}:{}),redirect:'manual',credentials:'omit',signal:requestSignal,
    ...(phase==='closing'?{cache:'no-store'}:{}),headers:{Accept:kind==='json'?'application/json':kind==='js'?'application/javascript':'text/html',
     ...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}:{})}}),requestSignal,late=>late?.body?.cancel())
   requestCheck()
   packet.headersObservedAt=new Date().toISOString();packet.finalURL=response.url;packet.status=response.status
   packet.headers=Object.fromEntries(response.headers.entries())
   need(response.url===url&&!response.redirected,'native response authority/path changed')
   if(response.status!==expectedStatus){primary=Object.assign(Error('HDFC native HTTP '+response.status),{code:'HDFC_NATIVE_HTTP',status:response.status,
    softFailure:true,abortRetries:true,failureKind:[401,403,429,451].includes(response.status)?'blocked_or_access_denied':'upstream_unavailable'})}
   const mime=packet.headers['content-type']||''
   if(!primary&&expectedStatus===200)need((kind==='json'?/^(?:application|text)\/(?:[\w.+-]+\+)?json\b/i
    :kind==='js'?/^(?:application|text)\/(?:x-)?(?:java|ecma)script\b/i:/^(?:text\/html|application\/xhtml\+xml)\b/i).test(mime),'native response MIME changed')
   const size=packet.headers['content-length']
   need(size===undefined||/^\d+$/.test(size)&&Number(size)<=settings.maxResponseBytes,'invalid native entity length')
   reader=response.body?.getReader()
   need(reader||expectedStatus===302&&Number(size)===0,'original native response stream missing')
   if(reader)for(;;){
    const item=await abortable(()=>reader.read(),requestSignal);requestCheck()
    if(item.done)break
    need(item.value instanceof Uint8Array,'invalid native response byte chunk')
    const bytes=item.value.byteLength;packet.receivedBodyBytes+=bytes
    need(bytes<=settings.maxResponseBytes-packet.bodyBytes&&bytes<=settings.maxTotalBytes-totalBytes,'native body byte budget reached')
    chunks.push(Buffer.from(item.value));packet.bodyBytes+=bytes;totalBytes+=bytes
   }
   const raw=Buffer.concat(chunks,packet.bodyBytes)
   packet.rawBodyBase64=raw.toString('base64');packet.body=new TextDecoder('utf-8',{fatal:true}).decode(raw)
   requestCheck()
   packet.bodySHA256=sha(raw);packet.bodyComplete=true;packet.completedAt=new Date().toISOString()
   requestCheck();if(primary)throw primary
   return packet
  }catch(error){
   if(!packet.bodyComplete){packet.rawBodyBase64=Buffer.concat(chunks,packet.bodyBytes).toString('base64');packet.acquisitionFailure={name:error?.name||null,code:error?.code||null}}
   cancel();options.signal?.throwIfAborted();throw primary||error
  }finally{release()}
 }
 return{read,receipts,settings,signal,check,metrics:()=>({requests:count,receivedBytes:totalBytes}),
  stop:reason=>{closed=true;clearTimeout(timer);if(!controller.signal.aborted)controller.abort(reason||Error('HDFC acquisition complete'))}}
}
