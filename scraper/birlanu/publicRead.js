// Anonymous public reads only. A denied host is closed for the remainder of a
// collection, including best-effort session seeding inside the native adapter.
export function createPublicReader({source,fetchImpl=fetch,signal,timeoutMs=120000,requestTimeoutMs=20000,allowedUrl}) {
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isFinite(requestTimeoutMs)||requestTimeoutMs<=0)throw Error(source+' invalid public time budget')
 const clock=new AbortController(),timer=setTimeout(()=>clock.abort(Error(source+' public collection deadline exceeded')),timeoutMs)
 const overall=signal?AbortSignal.any([signal,clock.signal]):clock.signal,blockedHosts=new Map(),responses=[]
 const wait=(operation,active)=>new Promise((resolve,reject)=>{
  const aborted=()=>{active.removeEventListener('abort',aborted);reject(signal?.aborted?signal.reason:active.reason)}
  if(active.aborted){aborted();return}active.addEventListener('abort',aborted,{once:true})
  Promise.resolve().then(operation).then(value=>{active.removeEventListener('abort',aborted);active.aborted?aborted():resolve(value)},error=>{active.removeEventListener('abort',aborted);active.aborted?aborted():reject(error)})
 })
 const fail=message=>{const error=Error(source+' '+message);error.abortRetries=true;error.failureKind='parser_or_contract_error';return error}
 const denied=status=>{const error=fail('public HTTP '+status);error.status=status;error.failureKind='blocked_or_access_denied';return error}
 const read=async(url,options={})=>{
  overall.throwIfAborted();if(!allowedUrl(url,options))throw fail('unreviewed public request')
  const target=new URL(url),prior=blockedHosts.get(target.host);if(prior)throw denied(prior)
  const requestClock=new AbortController(),requestTimer=setTimeout(()=>requestClock.abort(Error(source+' public request deadline exceeded')),requestTimeoutMs)
  const active=AbortSignal.any([overall,requestClock.signal]);let response
  try{
   try{response=await wait(()=>fetchImpl(url,{...options,redirect:'manual',signal:active}),active)}catch(error){if(active.aborted)throw error;throw fail('public transport unavailable')}
   if([401,403,429].includes(response?.status)){blockedHosts.set(target.host,response.status);Promise.resolve().then(()=>response.body?.cancel?.()).catch(()=>{});throw denied(response.status)}
   if(response?.status!==200)throw fail('unexpected public HTTP '+String(response?.status))
   if(response.url!==url)throw fail('public response URL identity changed')
   let body;try{body=await wait(()=>response.text(),active)}catch(error){if(active.aborted)throw error;throw fail('public response body unavailable')}
   if(typeof body!=='string'||Buffer.byteLength(body)>8*1024*1024)throw fail('public response body exceeds reviewed limit')
   const receipt={url,method:options.method??'GET',status:response.status,body,completedAt:new Date().toISOString()};responses.push(receipt)
   // Headers stay in memory for the shared ordinary public-session reader.
   return{ok:true,status:200,url,headers:response.headers,body:{cancel:async()=>{}},text:async()=>body,json:async()=>JSON.parse(body)}
  }finally{clearTimeout(requestTimer)}
 }
 return{read,responses,signal:overall,waitFor:operation=>wait(operation,overall),get deniedStatus(){return blockedHosts.values().next().value??null},denied,dispose:()=>clearTimeout(timer),fail}
}
