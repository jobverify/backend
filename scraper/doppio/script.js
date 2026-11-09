import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {settingsFor,runtime,bounded,failure,annotateFailure,errorValue} from './runtime20261107.js'
import {nativeTransport,MAX_BYTES} from './transport20261107.js'
import {SOURCE,HOMEPAGE_URL,CAREERS_PAGE_URL,VACANCY_CATEGORY_API_URL,buildVacancyPostsApiUrl,extractVacancyCategoryId,readPublishedPosts,readHomepage,readCurrentIntake,emptyAnalysis,facts,summary,attach,need} from './native20261107.js'
export {SOURCE,COMPANY,HOMEPAGE_URL,CAREERS_PAGE_URL,VACANCIES_PAGE_URL,VACANCY_CATEGORY_API_URL,buildVacancyPostsApiUrl,extractVacancyCategoryId,extractVacancyPosts} from './native20261107.js'
const diagnostic=error=>{const out={};for(const key of ['name','code','message','status']){const v=errorValue(error,key);if(typeof v==='string'||key==='status'&&Number.isInteger(v))out[key]=v}out.message??=typeof error==='string'?error:'Uninspectable native producer failure';return out}
export const createDoppioScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options),rt=runtime(settings),receipts=[],attempts=[]
 let analysis=emptyAnalysis(),primaryQualified=false,homepageEvidence=null,phase='company-homepage',currentURL=HOMEPAGE_URL,requestAdmitted=false,currentReceipt=null,currentReceiptIndex=null,reason='current-native-contract-unverified',incompleteCollectionFailure=null,observerFailure=null,originalFailure,hadFailure=false
 const collection=()=>({...summary(analysis),...analysis,status:'partial',reason,wholeCompanyScope:false,lifecycleCleanupAllowed:false,intakeFormFollowed:false,nativeHomepageEvidence:homepageEvidence,retainedNativeResponses:receipts,attempts,incompleteCollectionFailure,...(observerFailure?{observerFailure}:{})})
 const inventory=()=>({status:'coverage-gap',surface:CAREERS_PAGE_URL,firstParty:primaryQualified,listingComplete:false,pagesFetched:receipts.filter(r=>r.response.bodyComplete===true).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason})
 const retain=(response,url)=>{if(currentReceiptIndex===null){currentReceiptIndex=receipts.length;receipts.push({url,response})}else receipts[currentReceiptIndex]={url,response};if(requestAdmitted&&url===currentURL)currentReceipt=response}
 const report=async(error=null)=>{const audit={...collection(),nativeCollectionEvidence:collection(),inventoryEvidence:inventory(),partialNativeRecords:facts(analysis),partialNativeJobs:[],error:error===null?null:diagnostic(error)};if(settings.onAudit)try{await bounded(()=>settings.onAudit(structuredClone(audit)),{signal:rt.signal.aborted?undefined:rt.signal,timeoutMs:settings.auditTimeoutMs,code:'DOPPIO_AUDIT_TIMEOUT'})}catch(e){observerFailure=diagnostic(e);audit.observerFailure=observerFailure}return audit}
 const output=()=>{const jobs=attach([],collection(),inventory());if(hadFailure)Object.defineProperty(jobs,'nativeFailure',{value:originalFailure});return jobs}
 const physical=nativeTransport({timeoutMs:settings.readTimeoutMs,onReceipt:retain})
 function admit(url,stage){phase=stage;currentURL=url;requestAdmitted=false;currentReceipt=null;currentReceiptIndex=null;rt.admit();attempts.push({url,method:'GET',redirect:'manual',credentials:'omit'});requestAdmitted=true}
 async function read(url,stage){
  admit(url,stage)
  if(!settings.fetchPage&&!settings.fetchText){const p=await physical(url,{signal:rt.signal});rt.check();return p}
  return rt.read(async(signal,check)=>{
   const value=await(settings.fetchPage??settings.fetchText)(url,{method:'GET',redirect:'manual',credentials:'omit',signal});check()
   let packet
   if(typeof value==='string')packet={url,status:null,body:value,bodyComplete:true,injected:true,originalEntityAvailable:false}
   else{packet={url:null,status:null,body:null,bodyComplete:false,injected:true,originalEntityAvailable:false};for(const key of ['url','status','body','bodyComplete','bodyTruncated','rawBodyBase64','headers']){const v=errorValue(value,key);if(v!==undefined)packet[key]=v}if(packet.body===null){const html=errorValue(value,'html');if(typeof html==='string')packet.body=html}}
   retain(packet,url)
   need(packet.url===url&&(packet.status===null||Number.isInteger(packet.status)),'injected response identity unavailable')
   if(packet.status!==null&&packet.status!==200)throw Object.assign(failure('Doppio HTTP '+packet.status,'DOPPIO_HTTP_RESPONSE'),{status:packet.status})
   need(packet.bodyComplete===true&&!packet.bodyTruncated&&typeof packet.body==='string','injected native body incomplete or unavailable')
   need(Buffer.byteLength(packet.body)<=MAX_BYTES,'injected native body exceeds limit');return packet
  })
 }
 async function legacy(url,stage){admit(url,stage);return rt.read(async(signal,check)=>{const value=await settings.fetchJson(url,{method:'GET',redirect:'manual',credentials:'omit',signal});check();retain({url,status:null,body:JSON.stringify(value),bodyComplete:true,injected:true,originalEntityAvailable:false},url);return value})}
 try{
  if(settings.maxJobs===0||settings.maxPages===0||settings.maxRequests===0){reason='caller-zero-budget';await report();rt.check();return output()}
  if(settings.fetchJson){const categories=await legacy(VACANCY_CATEGORY_API_URL,'legacy-native-category'),id=extractVacancyCategoryId(categories),posts=await legacy(buildVacancyPostsApiUrl(id),'legacy-native-posts');analysis=readPublishedPosts(posts);reason='injected-legacy-blog-posts-await-role-country-publication-and-inventory-proof'}
  else{const home=await read(HOMEPAGE_URL,'company-homepage');homepageEvidence=readHomepage(home.body);primaryQualified=true;rt.check();const page=await read(CAREERS_PAGE_URL,'native-careers-intake');analysis=readCurrentIntake(page.body);reason='current-careers-open-application-intake-no-native-role-inventory-established'}
  rt.check();await report();rt.check();return output()
 }catch(cause){
  hadFailure=true;originalFailure=cause;incompleteCollectionFailure={...diagnostic(cause),phase,requestUrl:currentURL,requestAdmitted,status:requestAdmitted?(diagnostic(cause).status??currentReceipt?.status??null):null,abortRetries:true};reason='first-native-surface-failure';const audit=await report(cause)
  if(settings.signal?.aborted)throw settings.signal.reason
  let terminal=cause;try{rt.check()}catch(error){terminal=error}
  if(primaryQualified&&!rt.signal.aborted)return output()
  throw annotateFailure(terminal,{firstNativeFailure:originalFailure,abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,partialNativeRecords:facts(analysis),partialNativeJobs:[],retainedNativeResponses:receipts,inventoryEvidence:inventory(),nativeEvidence:audit})
 }finally{rt.close()}
}})
export const run=async(options={})=>createDoppioScraper(options).run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,SOURCE)}
