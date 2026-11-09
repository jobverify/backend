// Source-owned GET boundary for Adda247, ACTA.ai, ARMS4AI and AgentDNA.
// Every URL is declared by the individual public-source collector.
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {sha} from '../bizongo/publicRead.js'
import {parseRetryAfterHeader} from '../../scraper-support/utils/fetch.js'

const sources=new Set(['adda247','actaai','arms4ai','agentdna'])
export const coverageGap=(surface,reason)=>({status:'coverage-gap',surface,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason})
export const sourceFailure=(source,message,status=null)=>Object.assign(Error(source+': '+message),{source,status,code:'CURRENT_PUBLIC_SOURCE_UNAVAILABLE',softFailure:true,abortRetries:true,
 upstreamOutage:status>=500||[401,403,429,999].includes(status),failureKind:[401,403,429,999].includes(status)?'blocked_or_access_denied':status>=500?'network_or_timeout':'source_inventory_unavailable'})
export const requireSource=(value,source,message)=>{if(!value)throw sourceFailure(source,message)}
const cancel=body=>{try{Promise.resolve(body?.cancel?.()).catch(()=>{})}catch{ /* Cancellation is advisory; never wait on a denied body. */ }}
const header=(headers,name)=>typeof headers?.get==='function'?headers.get(name):Object.entries(headers||{}).find(([key])=>key.toLowerCase()===name)?.[1]??null

export async function collectPublicSource(source,options,allowed,operation){
 if(!sources.has(source))throw TypeError('Unreviewed current public source')
 const budget=options.collectionBudgetMs??options.timeoutMs??150000,requestBudget=options.requestTimeoutMs??20000
 if(!Number.isSafeInteger(budget)||budget<1||budget>300000||!Number.isSafeInteger(requestBudget)||requestBudget<1||requestBudget>30000)throw TypeError('Invalid current public source deadline')
 const caller=options.signal,controller=new AbortController(),timeout=sourceFailure(source,'collection deadline exceeded');timeout.name='TimeoutError'
 const timer=setTimeout(()=>controller.abort(timeout),budget),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[],denied=new Map()
 const bound=operation=>withCallerSignal(operation,signal)
 const stamp=()=>{const value=typeof options.now==='function'?options.now():options.now??new Date().toISOString();requireSource(typeof value==='string'&&Number.isFinite(Date.parse(value)),source,'invalid observation clock');return value}
 const read=async(url,{phase='opening',kind='html',allowedFinalUrls=[url]}={})=>{
  signal.throwIfAborted();requireSource(allowed.has(url),source,'undeclared public read')
  const host=new URL(url).hostname;if(denied.has(host))throw denied.get(host)
  const requestTimeout=AbortSignal.timeout(requestBudget),readSignal=AbortSignal.any([signal,requestTimeout]),bounded=operation=>withCallerSignal(operation,readSignal)
  const fetcher=options.fetchPage??options.fetchText??options.fetchImpl??globalThis.fetch,injected=options.fetchPage??options.fetchText??options.fetchImpl
  const request={method:'GET',redirect:'manual',signal:injected&&caller?caller:readSignal,headers:{Accept:kind==='json'?'application/json':kind==='javascript'?'application/javascript,text/javascript':'text/html,application/xhtml+xml', 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'}}
  const requestedAt=new Date().toISOString();let response
  try{response=await bounded(()=>fetcher(url,request))}catch(error){
   if(caller?.aborted)throw caller.reason
   if(Number.isInteger(error?.status)&&error.status>=100&&error.status<=999&&error.status!==200){
    const retained=sourceFailure(source,'current public HTTP '+error.status+'; stopped without retry',error.status)
    if(Number.isFinite(error.retryDelayMs))retained.retryDelayMs=error.retryDelayMs
    if([401,403,429,999].includes(error.status))denied.set(host,retained);retained.inventoryEvidence=coverageGap(url,'current public access unavailable');throw retained
   }
   throw error
  }
  if(typeof response==='string')response={url,status:200,html:response,responseIdentity:'caller-supplied-public-text'}
  requireSource(Number.isInteger(response?.status)&&typeof response.url==='string'&&allowedFinalUrls.includes(response.url)&&allowed.has(response.url),source,'public response identity changed')
  const status=response.status
  if(status!==200){
   const error=sourceFailure(source,'current public HTTP '+status+'; stopped without retry',status),retry=parseRetryAfterHeader(header(response.headers,'retry-after'))
   if(retry!=null)error.retryDelayMs=retry
   error.inventoryEvidence=coverageGap(url,'current configured public response unavailable');if([401,403,429,999].includes(status))denied.set(host,error)
   receipts.push({url,finalURL:response.url,status,phase,requestedAt,completedAt:new Date().toISOString(),bodyRead:false,...(retry!=null?{retryDelayMs:retry}:{})});cancel(response.body);throw error
  }
  const length=Number(header(response.headers,'content-length'))
  if(Number.isFinite(length)&&length>4*1024*1024){cancel(response.body);throw sourceFailure(source,'public body exceeds source byte bound')}
  let body=response.html??(typeof response.body==='string'?response.body:undefined)
  if(body===undefined&&typeof response.body?.getReader==='function'){
   const reader=response.body.getReader(),chunks=[];let bytes=0
   try{while(true){const part=await bounded(()=>reader.read());if(part.done)break;bytes+=part.value.byteLength;requireSource(bytes<=4*1024*1024,source,'public body exceeds source byte bound');chunks.push(Buffer.from(part.value))}body=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))}finally{cancel(reader);try{reader.releaseLock()}catch{}}
  }else if(body===undefined&&typeof response.text==='function')body=await bounded(()=>response.text())
  requireSource(typeof body==='string'&&Buffer.byteLength(body)<=4*1024*1024,source,'public body missing or exceeds source byte bound')
  if(kind==='html'&&/<(?:title|h1)\b[^>]*>\s*(?:access denied|just a moment|verify you are human|request rejected|captcha|attention required|robot check)|\bid=["'](?:challenge-form|cf-chl-)/i.test(body))throw sourceFailure(source,'current public access challenge; stopped without retry')
  receipts.push({url,finalURL:response.url,status,phase,kind,requestedAt,completedAt:new Date().toISOString(),bodySHA256:sha(body),bodyBytes:Buffer.byteLength(body),responseIdentity:response.responseIdentity??'current-public-GET'})
  if(kind==='json'){try{return JSON.parse(body)}catch{throw sourceFailure(source,'invalid native JSON response')}}
  return body
 }
 const audit=value=>bound(()=>options.onAudit?.(structuredClone({source,...value,retainedResponses:receipts,productionWrites:false,applicationActionPerformed:false})))
 try{signal.throwIfAborted();return await operation({read,audit,stamp,signal,receipts,bound})}catch(error){if(caller?.aborted)throw caller.reason;if(error&&typeof error==='object'&&Object.isExtensible(error)&&!error.inventoryEvidence)error.inventoryEvidence=coverageGap([...allowed][0],'current public inventory unavailable');throw error}finally{clearTimeout(timer)}
}
