// Keep admitted response/reader cancellation owned without allowing its
// underlying promise to hide a primary failure or hold the caller forever.
async function settleDisposal(start,{signal,bestEffort=false}={}){
 const started=performance.now();let timer,listener,timeoutReason
 const expired=()=>timeoutReason??=Object.assign(Error('Native response body cleanup deadline exceeded'),{
  name:'NativeResponseCleanupError',code:'NATIVE_RESPONSE_CLEANUP_TIMEOUT',localTimeout:true,abortRetries:true,
 })
 const checkGrace=()=>{if(performance.now()-started>=1000)throw expired()}
 const owned=Promise.resolve().then(()=>{
  let pending
  try{pending=Promise.resolve(start())}catch(error){checkGrace();throw error}
  pending.catch(()=>{});checkGrace();return pending
 }).then(value=>{checkGrace();return value})
 owned.catch(()=>{})
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(expired()),1000)})
 const interrupted=signal&&new Promise((_,reject)=>{
  listener=()=>reject(signal.reason)
  signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()
 })
 interrupted?.catch(()=>{})
 try{
  signal?.throwIfAborted()
  await Promise.race(interrupted?[owned,deadline,interrupted]:[owned,deadline])
  signal?.throwIfAborted()
 }catch(error){
  signal?.throwIfAborted()
  if(!bestEffort)throw error
 }finally{
  clearTimeout(timer);if(listener)signal.removeEventListener('abort',listener)
 }
}

export function disposeResponseBody(response,options){
 return settleDisposal(()=>response.body?.cancel(...(Object.hasOwn(options??{},'reason')?[options.reason]:[])),options)
}

export function disposeResponseReader(reader,options){
 return settleDisposal(()=>reader.cancel(...(Object.hasOwn(options??{},'reason')?[options.reason]:[])),options)
}
