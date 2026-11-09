import {createZohoNativeInventoryScraper} from '../../scraper-support/utils/zohoNativeInventory.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const OFFICIAL='https://sedintechnologies.com/careers/',BOARD='https://sedintechnologies.zohorecruit.in/jobs/Careers'
const API='https://sedintechnologies.zohorecruit.in/recruit/v2/public/Job_Openings'
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const config={source:'sedintechnologies',company:'Sedin Technologies',companyDomain:'sedintechnologies.com',officialUrl:OFFICIAL,boardUrl:BOARD,
 orgId:'202020000000344525',pageId:'202020000000344688',nativeCompany:'Sedin Technologies Private Limited'}
export async function runCurrentSedinZoho(options={}){
 const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(150000),...(options.signal?[options.signal]:[])]),records=new Map(),receipts=[]
 const fail=(message,fields={})=>Object.assign(Error('Sedin current native input: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',
  inventoryEvidence:{status:'coverage-gap',surface:OFFICIAL,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null},...fields})
 const read=async(url,json=false)=>{
  signal.throwIfAborted()
  try{
   if(![OFFICIAL,BOARD].includes(url)&&!url.startsWith(API+'?')&&!new RegExp('^'+API.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/\\d+\\?source=CareerSite&pagename=Careers$').test(url))throw fail('undeclared public endpoint')
   const response=await(options.fetchImpl||fetch)(url,{redirect:'manual',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{'User-Agent':'JobverifyScraper/1.0',Accept:json?'application/json':'text/html'}})
   if(response.status!==200){await response.body?.cancel();throw fail('HTTP '+response.status,{status:response.status,code:[401,403,406,429].includes(response.status)?'access_denied':'native_unavailable',failureKind:[401,403,406,429].includes(response.status)?'blocked_or_access_denied':'network_or_timeout'})}
   if(response.url!==url){await response.body?.cancel();throw fail('unexpected native redirect; response URL identity changed')}
   const body=await response.text();signal.throwIfAborted();if(Buffer.byteLength(body)>4000000)throw fail('response budget exceeded')
   if(/<title\b[^>]*>\s*(?:Access\s*Denied|Forbidden)\s*<\/title>|<Code>\s*AccessDenied\s*<\/Code>/i.test(body))throw fail('native access denial returned HTTP200',{status:response.status,code:'access_denied',failureKind:'blocked_or_access_denied'})
   if(!(json?/^application\/json\b/i:/^text\/html\b/i).test(response.headers?.get?.('content-type')||''))throw fail('native MIME identity changed')
   receipts.push({url,status:response.status});if(!json)return{status:response.status,url,html:body}
   const value=JSON.parse(body);if(!records.has(url))records.set(url,structuredClone(value));return value
  }catch(error){controller.abort(error);throw error}
 }
 const jobs=await createZohoNativeInventoryScraper(config).run({...options,signal,detailConcurrency:1,
  fetchPage:url=>read(url),fetchJson:url=>read(url,true)})
 for(const job of jobs){
  const url=API+'/'+job.jobId+'?source=CareerSite&pagename=Careers',original=records.get(url),closing=await read(url,true)
  if(stable(original)!==stable(closing))throw fail('closing full native role identity or criteria changed')
  job.sourceNativeListingRecord=structuredClone(records.get(API+'?source=CareerSite&pagename=Careers')?.data?.find(r=>r.id===job.jobId))
  job.sourceNativeDetailRecord=structuredClone(original.data[0]);job.sourceDetailComplete=true;job.sourceListingComplete=false;job.sourceScopeComplete=false;job.lifecycleCleanupAllowed=false
 }
 const current=await read(OFFICIAL)
 if(!current.html.includes(BOARD))throw fail('closing exact employer handoff changed')
 const evidence=readInventoryEvidence(jobs),audit={source:'sedintechnologies',nativeRecords:records.get(API+'?source=CareerSite&pagename=Careers')?.data,
  nativeReturnedRoles:jobs.length,closingFullCriteriaReconciled:true,receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 options.onAudit?.(audit)
 return attachInventoryEvidence(jobs,{...evidence,status:'discovery-only',listingComplete:false,indiaFacetCount:null,pagesFetched:receipts.length,
  reason:evidence.reason+';current-corporate-Zoho-handoff-and-closing-full-native-criteria;whole-company-scope-unqualified'})
}
