import {createHash} from 'node:crypto'
const sha=value=>createHash('sha256').update(value).digest('hex')
const check=(signal)=>signal?.throwIfAborted()
export async function waitFor(operation,signal){
 check(signal);let abort
 const stopped=new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true})})
 try{const result=await Promise.race([Promise.resolve().then(()=>{check(signal);return operation()}),stopped]);check(signal);return result}finally{signal.removeEventListener('abort',abort)}
}
export function airIndiaRuntime(fetchHtml,options){
 const sourceMs=options.sourceTimeoutMs??120000,readMs=options.readTimeoutMs??15000
 for(const [value,max]of [[sourceMs,180000],[readMs,30000]])if(!Number.isSafeInteger(value)||value<=0||value>max)throw TypeError('Invalid Air India request deadline')
 const controller=new AbortController(),timeout=Object.assign(Error('Air India source deadline exceeded'),{code:'AIRINDIA_SOURCE_TIMEOUT'}),timer=setTimeout(()=>controller.abort(timeout),sourceMs)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,receipts=[],sourceUntil=performance.now()+sourceMs
 const ensureSource=()=>{options.signal?.throwIfAborted();if(performance.now()>=sourceUntil&&!controller.signal.aborted)controller.abort(timeout);check(signal)}
 return{signal,receipts,check:ensureSource,close:()=>clearTimeout(timer),async read(url){
  ensureSource();const request=new AbortController(),deadline=Object.assign(Error('Air India public read deadline exceeded'),{code:'AIRINDIA_READ_TIMEOUT'}),readTimer=setTimeout(()=>request.abort(deadline),readMs),readSignal=AbortSignal.any([signal,request.signal]),readUntil=performance.now()+readMs
  const ensureRead=()=>{ensureSource();if(performance.now()>=readUntil&&!request.signal.aborted)request.abort(deadline);check(readSignal)}
  const receipt={url,status:null,responseURL:null,bodySHA256:null};receipts.push(receipt)
  try{return await waitFor(async()=>{
   const response=await fetchHtml(url,{signal:readSignal,includeResponseMetadata:true,redirect:'manual'})
   ensureRead()
   const callerText=typeof response==='string',status=callerText?null:response?.status,finalURL=callerText?url:response?.url
   Object.assign(receipt,{status,responseURL:finalURL,firstParty:!callerText&&status===200&&finalURL===url})
   if(!callerText&&(status!==200||finalURL!==url))throw Object.assign(Error('Air India public HTTP or URL identity changed'),{code:'AIRINDIA_PUBLIC_RESPONSE',status})
   const type=response?.headers?.get?.('content-type')??response?.headers?.['content-type']
   if(type&&!/^text\/html\b/i.test(type))throw Error('Air India public HTML content type changed')
   const html=callerText?response:typeof response?.html==='string'?response.html:await response.text()
   ensureRead();if(typeof html!=='string'||!html.trim()||Buffer.byteLength(html)>4*1024*1024)throw Error('Air India public HTML body unavailable or oversized')
   receipt.bodySHA256=sha(html);return html
  },readSignal)}finally{clearTimeout(readTimer);request.abort()}
 }}
}
