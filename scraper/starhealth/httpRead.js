// A public HTTP read has its own deadline inside the unchanged source budget.
// Race the operation as well as aborting it: injected or stalled readers may
// ignore their signal, and cleanup must preserve the original abort reason.
export async function readStarHealthHTTP(url,{fetchImpl,signal,requestTimeoutMs,gap}){
 signal.throwIfAborted()
 const controller=new AbortController(),requestSignal=controller.signal,cancelled=new WeakSet()
 let response,reader,stage='headers',timer,onAbort,released=false
 const cancelBody=reason=>{
  const target=reader??response?.body
  if(!target||cancelled.has(target))return
  cancelled.add(target)
  try{void Promise.resolve(target.cancel?.(reason)).catch(()=>{})}catch{/* Preserve the original read failure if cleanup throws. */}
 }
 const release=()=>{if(reader&&!released){try{reader.releaseLock();released=true}catch{/* A noncompliant reader must not replace the timeout reason. */}}}
 const forwardAbort=()=>controller.abort(signal.reason)
 signal.addEventListener('abort',forwardAbort,{once:true})
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{cancelBody(requestSignal.reason);reject(requestSignal.reason)}
  requestSignal.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>controller.abort(Object.assign(gap(`HTTP ${stage} timeout after ${requestTimeoutMs}ms at ${url}`),{
   name:'TimeoutError',requestUrl:url,requestStage:stage,requestTimeoutMs,
   softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout',abortRetries:true,
  })),requestTimeoutMs)
 })
 const acquire=async()=>{
  response=await fetchImpl(url,{signal:requestSignal,redirect:'error',headers:{Accept:'text/html,application/json'}})
  if(requestSignal.aborted)cancelBody(requestSignal.reason)
  requestSignal.throwIfAborted()
  if(response.url!==url){const error=gap('Source final URL changed');cancelBody(error);throw error}
  if(response.status!==200){const error=Object.assign(gap('Source HTTP failure'),{status:response.status});cancelBody(error);throw error}
  stage='body'
  let body
  if(response.body?.getReader){
   reader=response.body.getReader()
   const chunks=[];let bytes=0
   while(true){
    requestSignal.throwIfAborted()
    const {done,value}=await reader.read()
    requestSignal.throwIfAborted()
    if(done)break
    bytes+=value.byteLength
    if(bytes>4000000){const error=gap('Source body exceeds bound');cancelBody(error);throw error}
    chunks.push(value)
   }
   body=Buffer.concat(chunks).toString('utf8')
  }else body=await response.text()
  requestSignal.throwIfAborted()
  if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4000000)throw gap('Source body missing or exceeds bound')
  return {body,finalUrl:response.url,status:response.status}
 }
 try{return await Promise.race([acquire(),aborted])}
 finally{
  clearTimeout(timer)
  requestSignal.removeEventListener('abort',onAbort)
  signal.removeEventListener('abort',forwardAbort)
  release()
 }
}
