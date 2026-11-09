import {createHash} from 'node:crypto'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {buildHttpError} from '../../scraper-support/utils/fetch.js'
export const BATA_ORIGIN='https://bata.sensehq.com'
export const fail=(message,code='BATA_PUBLIC_NATIVE_CHANGED',status=null)=>Object.assign(Error('Bata India: '+message),{source:'bataindia',code,status,abortRetries:true,softFailure:true,failureKind:[401,403,429].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable'})
export const need=(value,message)=>{if(!value)throw fail(message)}
export const sha=value=>createHash('sha256').update(value).digest('hex')
export async function withCurrentBataRead(options,operation){
 const caller=options.signal,budget=options.collectionBudgetMs??180000,requestBudget=options.requestTimeoutMs??15000,interval=options.minRequestIntervalMs??500
 caller?.throwIfAborted()
 need(Number.isSafeInteger(budget)&&budget>0&&budget<=600000&&Number.isSafeInteger(requestBudget)&&requestBudget>0&&requestBudget<=30000,'invalid public collection bounds')
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&((options.fetchPage||options.fetchText||options.fetchImpl)||interval>=250),'invalid public host interval')
 const controller=new AbortController(),timeout=fail('public collection deadline exceeded','BATA_COLLECTION_TIMEOUT');timeout.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(timeout),budget),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[]
 let nextReadAt=0,totalBytes=0
 const read=async(url,phase)=>{
  const target=new URL(url)
  need(target.origin===BATA_ORIGIN&&!target.username&&!target.password&&!target.hash&&/^\/careers(?:\/iframe\/jobs|\/jobs\/\d+)?$/.test(target.pathname),'undeclared public hiring read')
  need(receipts.length<100,'public request budget exceeded');signal.throwIfAborted()
  const pause=Math.max(0,nextReadAt-Date.now())
  if(pause)await withCallerSignal(()=>new Promise(resolve=>setTimeout(resolve,pause)),signal)
  nextReadAt=Date.now()+interval
  const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal,AbortSignal.timeout(requestBudget)]),supplied=options.fetchPage??options.fetchText
  let response,reader
  const discard=async()=>{const body=reader??response?.body;if(typeof body?.cancel==='function')await withCallerSignal(()=>body.cancel(),AbortSignal.timeout(500)).catch(()=>{})}
  try{
   const request={method:'GET',redirect:'manual',signal:requestSignal,headers:{Accept:'text/html,application/xhtml+xml,*/*;q=0.8','User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)'}}
   response=await withCallerSignal(()=>supplied?supplied(url,request):(options.fetchImpl??globalThis.fetch)(url,request),requestSignal)
   need(Number.isInteger(response?.status)&&response.url===url,'public response status or final URL is unqualified')
   if(response.status!==200){const error=fail('public HTTP '+response.status,'BATA_PUBLIC_HTTP',response.status),native=buildHttpError(response,url);if(native.retryDelayMs!=null)error.retryDelayMs=native.retryDelayMs;throw error}
   let html=response.html??(typeof response.body==='string'?response.body:undefined)
   if(html===undefined&&typeof response.body?.getReader==='function'){
    reader=response.body.getReader();let bytes=0;const chunks=[]
    while(true){const part=await withCallerSignal(()=>reader.read(),requestSignal);if(part.done)break;bytes+=part.value.byteLength;need(bytes<=4*1024*1024,'public body exceeds input limit');chunks.push(Buffer.from(part.value))}
    html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));reader.releaseLock();reader=null
   }else if(html===undefined&&typeof response.text==='function')html=await withCallerSignal(()=>response.text(),requestSignal)
   need(typeof html==='string'&&Buffer.byteLength(html)<=4*1024*1024,'public body is missing or exceeds input limit')
   totalBytes+=Buffer.byteLength(html);need(totalBytes<=64*1024*1024,'public collection byte budget exceeded')
   receipts.push({phase,url,finalUrl:response.url,status:response.status,bytes:Buffer.byteLength(html),sha256:sha(html)})
   return html
  }finally{requestController.abort();await discard()}
 }
 try{return await withCallerSignal(()=>operation({read,signal,receipts,observe:fn=>withCallerSignal(fn,signal)}),signal)}finally{clearTimeout(timer)}
}
