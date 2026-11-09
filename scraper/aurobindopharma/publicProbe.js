import {createHash} from 'node:crypto'
import {buildHttpError} from '../../scraper-support/utils/fetch.js'
const approved=new Set(['avasoft','aurobindopharma','byjus','affordmed'])
const hash=value=>createHash('sha256').update(value).digest('hex')
const raced=(promise,signal)=>new Promise((resolve,reject)=>{const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason)};if(signal.aborted){Promise.resolve(promise).catch(()=>{});aborted();return}signal.addEventListener('abort',aborted,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',aborted);signal.aborted?aborted():resolve(value)},error=>{signal.removeEventListener('abort',aborted);signal.aborted?aborted():reject(error)})})
const header=(value,key)=>typeof value?.get==='function'?value.get(key):value?.[key]??null
export const withCurrentPublicProbe=async(source,options,operation)=>{
 if(!approved.has(source))throw Error('Unreviewed source public probe')
 const caller=options.signal,timeout=options.collectionTimeoutMs??120000,requestTimeout=options.requestTimeoutMs??25000
 caller?.throwIfAborted()
 if(!Number.isSafeInteger(timeout)||timeout<=0||timeout>600000||!Number.isSafeInteger(requestTimeout)||requestTimeout<=0||requestTimeout>30000)throw Error('Invalid current public probe bound')
 const startedAt=new Date().toISOString(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Current public source deadline exceeded','TimeoutError')),timeout),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[],denied=new Map()
 let bytesRead=0
 const gap=reason=>({status:'coverage-gap',surface:receipts[0]?.url??null,firstParty:false,listingComplete:false,pagesFetched:receipts.filter(r=>r.status===200).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason})
 const unavailable=(message,status=null)=>Object.assign(Error(message),{source,status,abortRetries:true,softFailure:true,upstreamOutage:[401,403,429].includes(status),failureKind:[401,403,429].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable',inventoryEvidence:gap(message)})
 const read=async(url,legacy)=>{
  signal.throwIfAborted();const parsed=new URL(url)
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)throw unavailable('Current public URL identity unqualified')
  if(denied.has(parsed.hostname))throw denied.get(parsed.hostname)
  if(receipts.length>=1100)throw unavailable('Current public request budget exceeded')
  const receipt={url,requestedAt:new Date().toISOString(),status:null};receipts.push(receipt)
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(requestTimeout)])
  let page
  try{
   if(options.fetchPage)page=await raced(Promise.resolve().then(()=>options.fetchPage(url,{method:'GET',headers:{Accept:'text/html,application/javascript,application/json,text/css,*/*;q=0.5'},signal:caller||requestSignal})),requestSignal)
   else if(options.fetchText)page={status:200,url,contentType:'text/html',body:await raced(Promise.resolve().then(()=>options.fetchText(url,{signal:caller||requestSignal})),requestSignal),legacyTextUnqualified:true}
   else if(legacy)page=await raced(Promise.resolve().then(()=>legacy(url,{method:'GET',headers:{Accept:'text/html'},signal:requestSignal})),requestSignal)
   else{
    const response=await raced(Promise.resolve().then(()=>(options.fetchImpl||globalThis.fetch)(url,{method:'GET',redirect:'manual',signal:requestSignal,headers:{Accept:'text/html,application/javascript,application/json,text/css,*/*;q=0.5','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'}})),requestSignal)
    Object.assign(receipt,{status:response.status,finalURL:response.url||url,contentType:response.headers.get('content-type')||'',location:response.headers.get('location')||null})
    if([401,403,429].includes(response.status)){const failure=unavailable('Current declared public source denied HTTP '+response.status,response.status),retry=buildHttpError(response,url);if(retry.retryDelayMs!=null)failure.retryDelayMs=retry.retryDelayMs;denied.set(parsed.hostname,failure);try{Promise.resolve(response.body?.cancel()).catch(()=>{})}catch{}throw failure}
    const bytes=Buffer.from(await raced(Promise.resolve().then(()=>response.arrayBuffer()),requestSignal));page={status:response.status,url:response.url||url,contentType:response.headers.get('content-type')||'',headers:Object.fromEntries(response.headers),originalBytes:bytes.length,originalSHA256:hash(bytes),body:new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
   }
   signal.throwIfAborted();const body=page?.body??page?.html??'',headers=page?.headers||{}
   Object.assign(receipt,{status:page?.status??null,finalURL:page?.url??null,contentType:page?.contentType??header(headers,'content-type')??'',location:header(headers,'location'),completedAt:new Date().toISOString(),bytes:page.originalBytes??Buffer.byteLength(body),sha256:page.originalSHA256??hash(body),decodedBodySHA256:hash(body)})
   bytesRead+=receipt.bytes
   if(!Number.isInteger(page?.status)||page.url!==url||typeof body!=='string'||receipt.bytes>8*1024*1024||bytesRead>96*1024*1024)throw unavailable('Current original public response identity or byte bound unqualified')
   if([401,403,429].includes(page.status)){const failure=unavailable('Current declared public source denied HTTP '+page.status,page.status),retry=buildHttpError({status:page.status,headers:{get:key=>header(headers,key)}},url);if(retry.retryDelayMs!=null)failure.retryDelayMs=retry.retryDelayMs;denied.set(parsed.hostname,failure);throw failure}
   return{...page,body,html:body,headers,contentType:receipt.contentType}
  }catch(error){if(caller?.aborted)throw caller.reason;if(signal.aborted)throw signal.reason;if(Number.isInteger(error?.status)){receipt.status=error.status;if([401,403,429].includes(error.status)){if(Object.isExtensible(error))Object.assign(error,{source,abortRetries:true,softFailure:true,upstreamOutage:true,inventoryEvidence:gap('Current declared public source denied HTTP '+error.status)});denied.set(parsed.hostname,error)}}throw error}
 }
 const audit=async value=>{signal.throwIfAborted();if(options.onAudit)await raced(Promise.resolve().then(()=>options.onAudit(structuredClone({...value,source,startedAt,completedAt:new Date().toISOString(),responses:receipts,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false}))),signal)}
 try{return await raced(Promise.resolve().then(()=>operation({source,signal,read,audit,unavailable,receipts,observe:promise=>raced(promise,signal)})),signal)}finally{clearTimeout(timer)}
}
