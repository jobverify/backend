import path from 'node:path'
import {fileURLToPath} from 'node:url'
import CATALOG from './catalog.js'
import {settingsFor,runtime,bounded,failure,annotateFailure,errorValue} from './runtime20261107.js'
import {nativeTransport,MAX_BYTES} from './transport20261107.js'
import {SOURCE,CAREERS_URL,readContractIntake,attachIntakeEvidence} from './native20261107.js'
import {readPublishedJobDiva} from './board20261107.js'
export {SOURCE,CAREERS_URL,extractJobCards,hasOfficialCareersSignal} from './native20261107.js'
export const PROVIDER_METADATA=CATALOG,COMPANY=CATALOG.companyName
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const diagnostic=error=>{const out={};for(const key of ['name','code','message','status','requestUrl','finalUrl','failureKind']){let value;try{value=errorValue(error,key)}catch{}if(typeof value==='string'||key==='status'&&Number.isInteger(value))out[key]=value}out.message??=typeof error==='string'?error:'Uninspectable native producer failure';return out}
const snapshot=value=>{
 const out={injected:true,originalEntityAvailable:false}
 for(const key of ['url','status','contentType','body','bodyComplete','bodyTruncated','rawBodyBase64','bodyBytes','receivedBodyBytes','bodyUnavailableReason','requestedAt','headersObservedAt','completedAt']){let v;try{v=errorValue(value,key)}catch{}if(v===null||['string','number','boolean'].includes(typeof v))out[key]=v}
 let headers;try{headers=errorValue(value,'headers')}catch{}
 try{out.headers=headers&&typeof headers==='object'?Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(headers)).filter(([,d])=>typeof d.value==='string').map(([k,d])=>[k.toLowerCase(),d.value])):null}catch{out.headers=null}
 return out
}
export const create22ndCenturyTechnologiesScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options),rt=runtime(settings),receipts=[],attempts=[]
 let analysis={observedStaffingCategories:[],withheldNativeFacts:[],unresolvedRows:[],duplicateRepresentations:[]},primaryQualified=false,observedAt=null,reason='staffing-intake-without-native-vacancy-proof',observerFailure=null,lastAudit=null,originalFailure,hadFailure=false,incompleteCollectionFailure=null,phase='contract-intake',currentURL=CAREERS_URL
 const board={handoffs:[],unqualifiedHandoffs:[],observedRSSRecords:[],rssDuplicateRepresentations:[],nativeRSS:null,nativeScriptContract:null,nativeSearch:null,reason:null}
 const facts=()=>[...analysis.withheldNativeFacts,...board.observedRSSRecords]
 const summary=()=>{const all=facts(),vacancies=board.observedRSSRecords.filter(r=>r.nativeVacancyCandidate===true).length,unresolved=board.observedRSSRecords.filter(r=>r.nativeIdentityUnresolved===true).length;return{source:SOURCE,recordKind:unresolved?'mixed':vacancies?all.length===vacancies?'vacancy-rows':'mixed':'hiring-signals',observedRecordCount:all.length,observedVacancyCount:vacancies,observedRSSRepresentationCount:board.nativeRSS?.observedItemCount??0,unresolvedRSSRecordCount:unresolved,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}}
 const collection=()=>({...summary(),...analysis,...board,withheldNativeFacts:facts(),status:'partial',reason,wholeCompanyScope:false,lifecycleCleanupAllowed:false,incompleteCollectionFailure,retainedNativeResponses:receipts,attempts,...(observerFailure?{observerFailure}:{})})
 const inventory=()=>({status:'coverage-gap',surface:CAREERS_URL,firstParty:primaryQualified,listingComplete:false,pagesFetched:receipts.filter(r=>r.response.bodyComplete===true).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason})
 const retain=(response,url)=>{const prior=receipts.find(r=>r.url===url);if(prior)prior.response=response;else receipts.push({url,response})}
 const report=async(error=null)=>{
  const audit={...collection(),nativeCollectionEvidence:collection(),inventoryEvidence:inventory(),partialNativeRecords:facts(),partialNativeJobs:[],error:error===null?null:diagnostic(error)};lastAudit=audit
  if(settings.onAudit)try{const pending=Promise.resolve(settings.onAudit(structuredClone(audit)));pending.catch(()=>{});await bounded(()=>pending,{signal:rt.signal.aborted?undefined:rt.signal,timeoutMs:settings.auditTimeoutMs,code:'TSCTI_AUDIT_TIMEOUT'})}catch(e){observerFailure=diagnostic(e);audit.observerFailure=observerFailure}
  return audit
 }
 const output=()=>{const jobs=attachIntakeEvidence([],collection(),inventory());if(hadFailure)Object.defineProperty(jobs,'nativeFailure',{value:originalFailure});return jobs}
 const physical=nativeTransport({timeoutMs:settings.readTimeoutMs,onReceipt:retain})
 async function read(url,kind='html',stage='contract-intake'){
  phase=stage;currentURL=url;rt.admit();attempts.push({url,method:'GET',redirect:'manual',credentials:'omit',requestedAt:new Date().toISOString()})
  if(!settings.fetchText){const packet=await physical(url,{signal:rt.signal,expectedMime:kind});rt.check();return packet}
  return rt.read(async(signal,check)=>{
   const value=await settings.fetchText(url,{method:'GET',redirect:'manual',credentials:'omit',signal,requestKind:kind})
   check()
   const explicit=value&&typeof value==='object'&&Object.hasOwn(value,'body')
   if(!explicit&&typeof value!=='string'){
    retain({url,status:null,body:null,bodyComplete:false,rawBodyBase64:null,injected:true,originalEntityAvailable:false,bodyUnavailableReason:'Injected native body is neither text nor a typed receipt',unqualifiedBodyType:typeof value},url)
    throw Object.assign(failure('22nd Century injected native body type unavailable','TSCTI_NATIVE_PROOF'),{cause:value})
   }
   const packet=explicit?snapshot(value):{url,status:200,body:value,bodyComplete:true,injected:true,originalEntityAvailable:false}
   retain(packet,url)
   if(packet.url!==url||!Number.isInteger(packet.status))throw failure('22nd Century injected response identity unavailable','TSCTI_RESPONSE_IDENTITY')
   if(packet.status!==200)throw Object.assign(failure('22nd Century HTTP '+packet.status,'TSCTI_HTTP_RESPONSE'),{status:packet.status,requestUrl:url,finalUrl:packet.url,abortRetries:true})
   if(packet.bodyComplete!==true||packet.bodyTruncated===true)throw failure('22nd Century incomplete native entity','TSCTI_NATIVE_PROOF')
   if(kind==='gzip-script'){
    if(typeof packet.rawBodyBase64!=='string'&&typeof packet.body==='string')packet.rawBodyBase64=Buffer.from(packet.body).toString('base64')
    if(typeof packet.rawBodyBase64!=='string'||Buffer.from(packet.rawBodyBase64,'base64').length>MAX_BYTES)throw failure('22nd Century original script bytes unavailable or oversized','TSCTI_BODY_LIMIT')
   }else if(typeof packet.body!=='string')throw failure('22nd Century injected native body unavailable','TSCTI_NATIVE_PROOF')
   else if(Buffer.byteLength(packet.body)>MAX_BYTES)throw failure('22nd Century injected native body exceeds limit','TSCTI_BODY_LIMIT')
   return packet
  })
 }
 try{
  if(settings.maxJobs===0||settings.maxPages===0||settings.maxRequests===0){reason='caller-zero-budget';await report();rt.check();return output()}
  const primary=await read(CAREERS_URL);analysis=readContractIntake(primary.body);primaryQualified=true;rt.check()
  const clock=settings.now?settings.now():new Date().toISOString();if(typeof clock!=='string'||!Number.isFinite(Date.parse(clock)))throw failure('22nd Century observation clock unavailable','TSCTI_NATIVE_PROOF');observedAt=clock
  if(analysis.unresolvedRows.length)reason='unclassified-native-contract-rows'
  else if(analysis.hasUnqualifiedChannels)reason='staffing-intake-with-unqualified-native-channels'
  else{await readPublishedJobDiva({read},primary.body,board);reason=board.reason??'native-job-board-scope-unverified'}
  rt.check();await report();rt.check();return output()
 }catch(cause){
  if(!hadFailure){hadFailure=true;originalFailure=cause;const observed=receipts.find(r=>r.url===currentURL)?.response;incompleteCollectionFailure={...diagnostic(cause),phase,requestUrl:currentURL,status:diagnostic(cause).status??observed?.status??null,requestAdmitted:attempts.at(-1)?.url===currentURL,abortRetries:true}}
  reason='first-native-surface-failure';const audit=lastAudit??await report(cause)
  if(settings.signal?.aborted)throw settings.signal.reason
  if(primaryQualified&&!rt.signal.aborted){rt.check();return output()}
  throw annotateFailure(cause,{abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,partialNativeRecords:facts(),partialNativeJobs:[],retainedNativeResponses:receipts,inventoryEvidence:inventory(),nativeEvidence:audit})
 }finally{rt.close()}
}})
export const run=async(options={})=>create22ndCenturyTechnologiesScraper(options).run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
