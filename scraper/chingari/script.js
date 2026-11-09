import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {settingsFor,runtime,bounded,failure,annotateFailure,errorValue} from './runtime20261107.js'
import {nativeTransport} from './transport20261107.js'
import {CAREERS_PAGE_URL,CAREERS_CATEGORY_API_URL,CAREERS_POSTS_API_URL,readChingariListing,extractCareerPosts,validateChingariPost} from './native20261107.js'
export {CAREERS_PAGE_URL,CAREERS_CATEGORY_API_URL,CAREERS_POSTS_API_URL,extractCareerPosts,hasOfficialCareersSignal} from './native20261107.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const diagnostic=error=>{
 const result={};for(const k of ['name','code','message']){let v;try{v=errorValue(error,k)}catch{}if(typeof v==='string')result[k]=v}
 result.message??=typeof error==='string'?error:'Uninspectable native producer failure';return result
}
const packetSnapshot=value=>{
 const result={injected:true,originalEntityAvailable:false}
 for(const key of ['url','status','contentType','body','bodyComplete','bodyTruncated','rawBodyBase64','bodyBytes','receivedBodyBytes','bodyUnavailableReason','requestedAt','headersObservedAt','completedAt']){
  let item;try{item=errorValue(value,key)}catch{}
  if(item===null||['string','boolean','number'].includes(typeof item))result[key]=item
 }
 let headers;try{headers=errorValue(value,'headers')}catch{}
 if(headers&&typeof headers==='object'){
  try{result.headers=Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(headers)).filter(([,d])=>typeof d.value==='string').map(([k,d])=>[k,d.value]))}catch{result.headers=null}
 }else result.headers=null
 return result
}
export const createChingariScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options),jobs=[],receipts=[],attempts=[]
 let primaryQualified=false,observedAt=null,reason='native-career-inventory-not-reconciled',observerFailure=null,lastAudit=null
 const rt=runtime(settings)
 const collection=()=>({source:'chingari',status:'partial',reason,sourceScopeComplete:false,wholeCompanyScope:false,lifecycleCleanupAllowed:false,withheldNativeFacts:[...jobs],retainedNativeResponses:receipts,attempts,...(observerFailure?{observerFailure}: {})})
 const inventory=()=>({status:jobs.length?'discovery-only':'coverage-gap',surface:CAREERS_PAGE_URL,firstParty:primaryQualified,listingComplete:false,pagesFetched:receipts.filter(r=>r.response.bodyComplete===true).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason})
 const retain=(response,url)=>{const prior=receipts.find(r=>r.url===url);if(prior)prior.response=response;else receipts.push({url,response})}
 const report=async(error=null)=>{
  const audit={...collection(),partialNativeJobs:[...jobs],nativeCollectionEvidence:collection(),inventoryEvidence:inventory(),error:error===null?null:diagnostic(error)}
  lastAudit=audit
  if(settings.onAudit)try{
   // Deliver already-collected facts even when acquisition was cancelled.
   // The observer sees only a detached copy, including after its own deadline.
   const result=settings.onAudit(structuredClone(audit)),pending=Promise.resolve(result);pending.catch(()=>{})
   const signal=rt.signal.aborted?undefined:rt.signal
   await bounded(()=>pending,{signal,timeoutMs:settings.auditTimeoutMs,code:'CHINGARI_AUDIT_TIMEOUT'})
  }catch(e){observerFailure=diagnostic(e);audit.observerFailure=observerFailure}
  return audit
 }
 const output=()=>{attachInventoryEvidence(jobs,inventory());Object.defineProperty(jobs,'nativeCollectionEvidence',{value:collection()});return jobs}
 const physical=nativeTransport({timeoutMs:settings.readTimeoutMs,onReceipt:retain})
 async function read(url,kind){
  rt.admit();attempts.push({url,method:'GET',redirect:'manual',credentials:'omit',requestedAt:new Date().toISOString()})
  const injected=kind==='json'?settings.fetchJson:settings.fetchText
  let result
  if(!injected){
   // The physical transport owns its read deadline and primary HTTP failure.
   result=(await physical(url,{signal:rt.signal,expectedMime:kind})).body;rt.check()
  }else result=await rt.read(async signal=>{
   const value=await injected(url,{method:'GET',redirect:'manual',credentials:'omit',signal})
   const explicit=value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'body')
   const packet=explicit?packetSnapshot(value):{url,status:200,headers:null,contentType:null,body:typeof value==='string'?value:JSON.stringify(value),bodyComplete:true,injected:true,originalEntityAvailable:false}
   retain(packet,url)
   if(packet.url!==url||packet.status!==200||typeof packet.body!=='string')throw failure('Chingari injected response identity, status or body mismatch','CHINGARI_RESPONSE_IDENTITY')
   if(packet.bodyComplete!==true||packet.bodyTruncated===true)throw failure('Chingari incomplete native response entity','CHINGARI_NATIVE_PROOF')
   return packet.body
  })
  if(kind==='json')try{return JSON.parse(result)}catch{throw failure('Chingari malformed JSON inventory','CHINGARI_NATIVE_PROOF')}
  return result
 }
 try{
  if(settings.maxJobs===0||settings.maxPages===0||settings.maxRequests===0){reason='caller-zero-budget';await report();rt.check();return output()}
  const listing=readChingariListing(await read(CAREERS_PAGE_URL,'html'));primaryQualified=true;observedAt=new Date().toISOString();rt.check()
  const categories=await read(CAREERS_CATEGORY_API_URL,'json')
  if(!Array.isArray(categories)||categories.some(c=>!Number.isSafeInteger(c?.id)||c.id<1||typeof c.name!=='string'||!c.name.trim())||new Set(categories.map(c=>c.id)).size!==categories.length)throw failure('Chingari category inventory malformed','CHINGARI_NATIVE_PROOF')
  const categoryMap=new Map(categories.map(c=>[c.id,c.name])),posts=await read(CAREERS_POSTS_API_URL,'json')
  if(!Array.isArray(posts)||!posts.length)throw failure('Chingari post inventory malformed or contradicts live listing','CHINGARI_NATIVE_PROOF')
  const validated=posts.map(record=>({record,...validateChingariPost(record)})),byId=new Map(validated.map(p=>[p.id,p]))
  if(byId.size!==validated.length)throw failure('Chingari duplicate post inventory identity','CHINGARI_NATIVE_PROOF')
  for(const published of listing.records){
   const post=byId.get(published.id)
   if(!post||post.sourceUrl!==published.url||post.title!==published.title)throw failure('Chingari listing/API title or URL identity mismatch','CHINGARI_NATIVE_PROOF')
  }
  rt.check()
  for(const {record,id} of validated){
   const published=listing.records.find(p=>p.id===id)
   if(!published){reason='native-listing-pagination-not-reconciled';break}
   if(settings.maxJobs!==null&&jobs.length>=settings.maxJobs){reason='caller-job-budget';break}
   const html=await read(record.link,'html'),model=extractCareerPosts([record],{categoryMap,detailPages:new Map([[record.link,html]])})[0]
   const job={...model,source:'chingari',link:model.applyUrl??model.sourceUrl,scrapedAt:null};jobs.push(job);rt.check()
   const clock=settings.now?settings.now():new Date().toISOString();if(typeof clock!=='string'||!Number.isFinite(Date.parse(clock)))throw failure('Chingari observation time unavailable','CHINGARI_NATIVE_PROOF')
   job.scrapedAt=clock;rt.check()
   if(!model.country){reason='native-role-country-unverified';break}
   if(!model.nativeApplicationEvidence){reason='native-role-application-unverified';break}
  }
  rt.check();await report();rt.check();return output()
 }catch(cause){
  reason='first-native-surface-failure';const audit=lastAudit??await report(cause)
  if(settings.signal?.aborted)throw settings.signal.reason
  throw annotateFailure(cause,{abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,partialNativeJobs:[...jobs],retainedNativeResponses:receipts,inventoryEvidence:inventory(),nativeEvidence:audit})
 }finally{rt.close()}
}})
export const run=async(options={})=>createChingariScraper(options).run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,'chingari')
}
