import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {buildHttpError} from '../../scraper-support/utils/fetch.js'

export const SOURCE='annapurnafinance'
export const fail=(message,code='ANNAPURNA_PUBLIC_CONTRACT',status=null)=>Object.assign(Error('Annapurna Finance: '+message),{
 source:SOURCE,code,status,abortRetries:true,softFailure:true,
 failureKind:[401,403,429].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable',
})
export const need=(value,message)=>{if(!value)throw fail(message)}
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)

export async function withAnnapurnaPublicRead(options,operation){
 const caller=options.signal,budget=options.collectionBudgetMs??options.timeoutMs??900000,requestBudget=options.requestTimeoutMs??25000,interval=options.minRequestIntervalMs??500
 caller?.throwIfAborted()
 need(Number.isSafeInteger(budget)&&budget>0&&budget<=900000&&Number.isSafeInteger(requestBudget)&&requestBudget>0&&requestBudget<=30000,'invalid public request bounds')
 const supplied=options.fetchPage??options.fetchText??options.fetchImpl
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(supplied||interval>=250),'invalid public request interval')
 const controller=new AbortController(),deadline=fail('public collection deadline exceeded','ANNAPURNA_COLLECTION_TIMEOUT');deadline.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(deadline),budget),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[]
 let nextReadAt=0,attempts=0,totalBytes=0
 const read=async(url,{label,phase='opening',method='GET',headers={},body,redirect=false}={})=>{
  signal.throwIfAborted();need(++attempts<=1100,'public request budget exceeded')
  const target=new URL(url)
  need(target.protocol==='https:'&&!target.username&&!target.password&&!target.hash,'invalid public hiring target')
  need(['annapurnafinance.in','hr1.to','career.hrone.cloud','gateway.app.hrone.cloud'].includes(target.hostname),'undeclared public hiring host')
  need(method==='GET'||method==='POST'&&target.origin==='https://gateway.app.hrone.cloud'&&target.pathname==='/api/external/public/referral/CareerPosition/Details','undeclared public read operation')
  const scheduledAt=Math.max(Date.now(),nextReadAt);nextReadAt=scheduledAt+interval
  if(scheduledAt>Date.now())await withCallerSignal(()=>new Promise(resolve=>setTimeout(resolve,Math.max(0,scheduledAt-Date.now()))),signal)
  const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal,AbortSignal.timeout(requestBudget)])
  let response,reader,readError
  const receipt={label,phase,method,startedAt:new Date().toISOString()};receipts.push(receipt)
  const discard=async()=>{const stream=reader??response?.body;if(typeof stream?.cancel==='function')await withCallerSignal(()=>stream.cancel(),AbortSignal.timeout(500)).catch(()=>{})}
  try{
   response=await withCallerSignal(()=>(supplied??globalThis.fetch)(url,{
    method,redirect:'manual',credentials:'omit',signal:requestSignal,
    headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'application/json,text/html,*/*;q=0.8',...headers},...(body===undefined?{}:{body}),
   }),requestSignal)
   need(Number.isInteger(response?.status)&&response.url===url,'public response status or final URL changed')
   receipt.status=response.status
   if(redirect&&[301,302,303,307,308].includes(response.status)){
    const location=response.headers?.get?.('location');need(typeof location==='string','public portal redirect unavailable')
    receipt.completedAt=new Date().toISOString();return{location:new URL(location,url).href}
   }
   if(response.status!==200){
    const error=fail('public HTTP '+response.status+'; stopped without retry','ANNAPURNA_PUBLIC_HTTP',response.status),native=buildHttpError(response,'https://annapurnafinance.in/career/career-openings')
    if(native.retryDelayMs!=null)error.retryDelayMs=native.retryDelayMs
    throw error
   }
   let text=response.html??(typeof response.body==='string'?response.body:undefined)
   if(text===undefined&&typeof response.body?.getReader==='function'){
    reader=response.body.getReader();const chunks=[];let bytes=0
    while(true){const part=await withCallerSignal(()=>reader.read(),requestSignal);if(part.done)break;bytes+=part.value.byteLength;need(bytes<=8*1024*1024,'public body exceeds input limit');chunks.push(Buffer.from(part.value))}
    text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));reader.releaseLock();reader=null
   }else if(text===undefined&&typeof response.text==='function')text=await withCallerSignal(()=>response.text(),requestSignal)
   need(typeof text==='string'&&Buffer.byteLength(text)<=8*1024*1024,'public body unavailable or oversized')
   totalBytes+=Buffer.byteLength(text);need(totalBytes<=128*1024*1024,'public collection byte budget exceeded')
   Object.assign(receipt,{bytes:Buffer.byteLength(text),sha256:sha(text),completedAt:new Date().toISOString()})
   return text
  }catch(error){
   readError=error;receipt.completedAt=new Date().toISOString()
   if(caller?.aborted)throw caller.reason
   if(signal.aborted)throw signal.reason
   const safe=error?.source===SOURCE?error:fail(error?.name==='TimeoutError'?'public request deadline exceeded':'public transport unavailable','ANNAPURNA_PUBLIC_TRANSPORT')
   receipt.errorCode=safe.code
   // Stop concurrent public reads after the first source failure.
   controller.abort(safe);throw safe
  }finally{requestController.abort(readError);await discard()}
 }
 const observe=async(value,{afterFailure=false}={})=>{
  if(typeof options.onAudit!=='function')return
  const observerSignal=afterFailure?(caller?AbortSignal.any([caller,AbortSignal.timeout(2000)]):AbortSignal.timeout(2000)):signal
  await withCallerSignal(()=>options.onAudit(structuredClone({source:SOURCE,productionWrites:false,...value,publicReadReceipts:receipts})),observerSignal)
 }
 // Every external await above is already bounded. Await the operation itself
 // so its bounded local failure-audit cleanup finishes before returning.
 try{return await operation({read,signal,receipts,observe})}
 finally{clearTimeout(timer);controller.abort()}
}
