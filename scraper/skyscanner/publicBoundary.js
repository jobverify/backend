import {buildHttpError} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const sources=new Set(['skyscanner','canva','atherenergy','bnpparibas'])
const denied=status=>[401,403,429].includes(status)
const headersGet=(headers,name)=>typeof headers?.get==='function'?headers.get(name):headers?.[name]??headers?.[name.toLowerCase()]??null
const observed=(promise,signal)=>new Promise((resolve,reject)=>{const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason)};if(signal.aborted){Promise.resolve(promise).catch(()=>{});abort();return}signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);signal.aborted?abort():resolve(value)},error=>{signal.removeEventListener('abort',abort);signal.aborted?abort():reject(error)})})
export const runPublicCollection=async(source,options,operation)=>{
 if(!sources.has(source))throw Error('Unreviewed source public boundary')
 const caller=options.signal,timeout=options.collectionTimeoutMs??90000,requestTimeout=options.requestTimeoutMs??20000,maxRequests=options.maxPublicRequests??1000
 caller?.throwIfAborted()
 if(!Number.isSafeInteger(timeout)||timeout<=0||timeout>300000||!Number.isSafeInteger(requestTimeout)||requestTimeout<=0||requestTimeout>30000||!Number.isSafeInteger(maxRequests)||maxRequests<=0||maxRequests>10000)throw Error('Invalid public source collection bound')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Public source collection deadline exceeded','TimeoutError')),timeout),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[],blockedHosts=new Map()
 let requests=0
 const gap=reason=>({status:'coverage-gap',surface:receipts[0]?.url??null,firstParty:false,listingComplete:false,pagesFetched:receipts.filter(r=>r.status===200).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason})
 const annotate=(error,url)=>{
  if(caller?.aborted)return caller.reason
  let status=Number.isInteger(error?.status)?error.status:Number.isInteger(error?.cause?.status)?error.cause.status:null
  if(status==null&&typeof error?.message==='string'&&url){const match=/^HTTP (\d{3}) for (.+)$/.exec(error.message);if(match&&match[2]===url)status=Number(match[1])}
  if(!error||typeof error!=='object')return error
  if(!Object.isExtensible(error))error=Object.assign(Error(error.message||'Public source read failed',{cause:error}),{name:error.name||'Error'})
  error.source??=source;error.inventoryEvidence=gap(status?'native-http-'+status+'-inventory-unavailable':'public-native-inventory-unqualified')
  if(status!=null){error.status=status;if(denied(status)){
   const retained=[...blockedHosts.values()].find(value=>value.status===status)
   if(error.retryDelayMs==null&&retained?.retryDelayMs!=null)error.retryDelayMs=retained.retryDelayMs
   error.abortRetries=true;error.softFailure=true;error.upstreamOutage=true
   if(source==='skyscanner'&&(!error.failureKind||error.failureKind==='blocked_or_access_denied'))error.failureKind='public_access_denied'
   else error.failureKind??='blocked_or_access_denied'
  }}
  if(error.name==='TimeoutError'){error.abortRetries=true;error.softFailure=true;error.localTimeout=true;error.failureKind??='network_or_timeout'}
  return error
 }
 const unavailable=message=>annotate(Object.assign(Error(message),{abortRetries:true,softFailure:true,upstreamOutage:false,failureKind:'source_inventory_unavailable'}))
 const http=(url,status,headers)=>{
  const error=buildHttpError({status,headers:{get:name=>headersGet(headers,name)}},url)
  if(source==='skyscanner'&&status>=300&&status<400){try{const location=new URL(headersGet(headers,'location'),url);if(location.origin===new URL(url).origin&&location.pathname==='/sttc/px/captcha-v2/index.html')Object.assign(error,{abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:'public_access_denied'})}catch{}}
  return annotate(error,url)
 }
 const read=async(url,transport)=>{
  signal.throwIfAborted();const parsed=new URL(url)
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)throw unavailable('Public source URL identity unavailable')
  if(blockedHosts.has(parsed.hostname))throw blockedHosts.get(parsed.hostname)
  if(++requests>maxRequests)throw unavailable('Public source request budget exceeded')
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(requestTimeout)]),receipt={url,status:null,finalURL:null};receipts.push(receipt)
  try{
   const page=await observed(Promise.resolve().then(()=>transport({signal:caller||requestSignal,requestSignal})),requestSignal)
   signal.throwIfAborted();Object.assign(receipt,{status:Number.isInteger(page?.status)?page.status:null,finalURL:page?.url??null})
   if(denied(page?.status))blockedHosts.set(parsed.hostname,http(url,page.status,page.headers))
   if(typeof page==='string'&&Buffer.byteLength(page)>3000000||typeof page?.html==='string'&&Buffer.byteLength(page.html)>3000000)throw unavailable('Public source response byte bound exceeded')
   return page
  }catch(error){const failure=annotate(error,url);if(Number.isInteger(failure?.status))receipt.status=failure.status;if(denied(failure?.status))blockedHosts.set(parsed.hostname,failure);throw failure}
 }
 const fetchPage=(url,fetchImpl=globalThis.fetch,headers={})=>read(url,async context=>{
  const response=await observed(Promise.resolve().then(()=>fetchImpl(url,{method:'GET',redirect:'manual',signal:context.requestSignal,headers:{'User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)',Accept:'text/html,application/xhtml+xml,*/*;q=0.5',...headers}})),context.requestSignal)
  if(response.status!==200){try{Promise.resolve(response.body?.cancel()).catch(()=>{})}catch{}throw http(url,response.status,response.headers)}
  const html=await observed(Promise.resolve().then(()=>response.text()),context.requestSignal)
  return{url:response.url||url,status:response.status,headers:Object.fromEntries(response.headers),html}
 })
 try{
  const result=await observed(Promise.resolve().then(()=>operation({signal,read,fetchPage,unavailable,receipts})),signal)
  signal.throwIfAborted();if(blockedHosts.size)throw blockedHosts.values().next().value
  if(Array.isArray(result)&&!readInventoryEvidence(result)){for(const row of result)Object.assign(row,{sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false});attachInventoryEvidence(result,gap('public-native-inventory-and-full-detail-completeness-unqualified'))}
  return result
 }catch(error){throw annotate(error)}finally{clearTimeout(timer)}
}
