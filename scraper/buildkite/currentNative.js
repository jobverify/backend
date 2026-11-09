import {createHash} from 'node:crypto'
import {createNativeGreenhouseScraper,NATIVE_GREENHOUSE_PROFILES,nativeEnvelopeFailed} from '../../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import {officeIndex,nativeHTMLText} from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readCurrentInventoryClient,buildkiteInventoryAsset} from './inventoryClient.js'
import {reviewNativeWorkCountry} from './countryProof.js'
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex')
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const requireCurrent=(ok,message)=>{if(!ok)throw Error('Current declared Greenhouse: '+message)}
const nativeFields=new Set('absolute_url data_compliance internal_job_id location metadata id updated_at requisition_id title pay_input_ranges company_name first_published language application_deadline content departments offices ai_disclaimer include_ai_disclaimer ai_opt_out_request_url'.split(' '))
// Consent/AI opt-out configuration belongs to application handling, not the
// published vacancy criteria. Retain it in every original model without making
// a private application configuration a public-JD completion prerequisite.
const model=record=>record&&Object.fromEntries(Object.entries(record).filter(([key])=>!['updated_at','data_compliance','ai_opt_out_request_url'].includes(key)))
const feedModel=value=>value&&({...value,jobs:value.jobs?.map(model)})
const knownPost=record=>record?.internal_job_id===null?'prospect':Number.isSafeInteger(record?.internal_job_id)&&record.internal_job_id>0?'job':'unresolved'
const nativeFeed=value=>{
 requireCurrent(value&&Object.keys(value).every(k=>['jobs','meta'].includes(k))&&Array.isArray(value.jobs)&&value.jobs.length<=2000&&!nativeEnvelopeFailed(value),'native listing envelope unavailable or changed')
 requireCurrent(value.meta&&Number.isSafeInteger(value.meta.total)&&value.meta.total===value.jobs.length&&Object.keys(value.meta).every(k=>k==='total')&&new Set(value.jobs.map(r=>r.id)).size===value.jobs.length&&value.jobs.every(r=>Number.isSafeInteger(r.id)&&r.id>0),'native listing count, identity or pagination changed')
 return value
}
const bounded=(promise,signal)=>new Promise((resolve,reject)=>{const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason)};if(signal.aborted){Promise.resolve(promise).catch(()=>{});abort();return}signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);signal.aborted?abort():resolve(value)},error=>{signal.removeEventListener('abort',abort);signal.aborted?abort():reject(error)})})
export const createCurrentGreenhouseScraper=(source,defaults={})=>({async run(passed={}){
 requireCurrent(['buildkite','tripadvisor'].includes(source),'unreviewed configured source')
 const options={...defaults,...passed},profile=structuredClone(NATIVE_GREENHOUSE_PROFILES[source]),base=profile.publicAPIBase,feedURL=base+'/jobs?content=true',caller=options.signal
 caller?.throwIfAborted()
 requireCurrent(!(options.fetchJson||options.fetchText)||options.fetchPage||options.fetchImpl,'Parsed fetchJson alone has no original HTTP provenance; provide original public Responses')
 const maxJobs=options.maxJobs??null,timeout=options.collectionTimeoutMs??240000
 requireCurrent(maxJobs===null||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'maxJobs must be a nonnegative safe integer or null')
 requireCurrent(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=300000,'collection deadline is invalid')
 const stamp=()=>{const value=options.now?options.now():new Date().toISOString();const date=new Date(value);requireCurrent(Number.isFinite(+date),'invalid collection clock');return date.toISOString()}
 const startedAt=stamp(),responses=[],snapshots=[],denied=new Set(),starts=new Map(),assets=new Set(),issues=[]
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('Public inventory collection deadline exceeded','TimeoutError')),timeout),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 let aggregateBytes=0,nativeAudit=null
 const allowed=url=>{const u=new URL(url);return !u.username&&!u.password&&!u.hash&&(url===profile.primaryURL||source==='tripadvisor'&&url==='https://careers.tripadvisor.com/all-jobs'||assets.has(url)||url===base||url===base+'/offices'||url===feedURL||source==='tripadvisor'&&url===base+'/departments'||u.origin===new URL(base).origin&&u.pathname.startsWith(new URL(base).pathname+'/jobs/')&&/^\d+$/.test(u.pathname.slice((new URL(base).pathname+'/jobs/').length))&&u.search==='?pay_transparency=true')}
 const sourceSignal=signal
 const read=async(url,signal=sourceSignal)=>{
  signal.throwIfAborted();requireCurrent(allowed(url),'URL is not a current declared public read')
  const host=new URL(url).hostname;requireCurrent(!denied.has(host),'public host is unavailable for this attempt')
  requireCurrent(responses.length<420,'public request budget exceeded')
  const requestedAt=stamp();let result
  // Each physical request remains bounded even when its source hook composes
  // several reads. Abort the owned source so a late callback cannot continue.
  const requestTimer=setTimeout(()=>controller.abort(Error('Declared Greenhouse native read deadline')),15000)
  try{
  if(options.fetchPage)result=await bounded(Promise.resolve().then(()=>{signal.throwIfAborted();return options.fetchPage(url,{signal})}),signal)
  else{
   const begin=Math.max(Date.now(),starts.get(host)||0);starts.set(host,begin+500)
   if(begin>Date.now())await bounded(new Promise(resolve=>setTimeout(resolve,begin-Date.now())),signal)
   signal.throwIfAborted();requireCurrent(!denied.has(host),'public host became unavailable while queued')
   const requestSignal=signal,r=await bounded(Promise.resolve().then(()=>{requestSignal.throwIfAborted();return(options.fetchImpl||globalThis.fetch)(url,{method:'GET',redirect:'manual',signal:requestSignal,headers:{Accept:'text/html,application/json,application/javascript,*/*;q=0.5','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'}})}),requestSignal)
   if([401,403,429].includes(r.status))denied.add(host)
   const bytes=Buffer.from(await bounded(Promise.resolve().then(()=>{requestSignal.throwIfAborted();return r.arrayBuffer()}),requestSignal))
   result={url:r.url,status:r.status,headers:Object.fromEntries(r.headers),bodyBase64:bytes.toString('base64')}
  }
  signal.throwIfAborted()
  if([401,403,429].includes(result?.status))denied.add(host)
  requireCurrent(result&&typeof result.bodyBase64==='string'&&Number.isSafeInteger(result.status)&&result.url===url,'original HTTP identity or complete bytes unavailable')
  const bytes=Buffer.from(result.bodyBase64,'base64');aggregateBytes+=bytes.length
  requireCurrent(bytes.length<=16*1024*1024&&aggregateBytes<=96*1024*1024,'public response byte budget exceeded')
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),receipt={url,status:result.status,finalURL:result.url,headers:result.headers||{},bytes:bytes.length,bodySHA256:sha(bytes),requestedAt,completedAt:stamp(),bodyBase64:result.bodyBase64,originalText:text}
  responses.push(receipt)
  return{...result,headers:result.headers||{}}
  }finally{clearTimeout(requestTimer)}
 }
 const originalText=page=>{requireCurrent(page.status===200,'public HTTP response unavailable: '+page.status);return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(page.bodyBase64,'base64'))}
 const json=page=>{const value=readLiteralModel(originalText(page)).value;requireCurrent(!nativeEnvelopeFailed(value),'public JSON error envelope');return value}
 const fetchPage=async(url,{signal=sourceSignal}={})=>{
  const page=await read(url,signal)
  if(url!==profile.primaryURL||page.status!==200)return page
  const snapshot={phase:snapshots.length===0?'opening':snapshots.length===1?'closing':'final',qualified:false};snapshots.push(snapshot)
  try{
   const html=originalText(page)
   if(source==='buildkite'){
    const asset=buildkiteInventoryAsset(html);assets.add(asset)
    snapshot.publicClient=readCurrentInventoryClient(source,html,originalText(await read(asset,signal)))
   }else{
    const links=readNativeDocument(html).nodes(n=>n.tag==='a'&&!n.inert&&n.attrs.href).filter(n=>{try{return new URL(n.attrs.href,profile.primaryURL).href==='https://careers.tripadvisor.com/all-jobs'}catch{return false}})
    requireCurrent(links.length>0,'current corporate Open Positions route changed')
    snapshot.publicClient=readCurrentInventoryClient(source,html)
    const allHTML=originalText(await read('https://careers.tripadvisor.com/all-jobs',signal))
    snapshot.allJobsClient=readCurrentInventoryClient(source,allHTML)
    requireCurrent(snapshot.allJobsClient.publicProgramSHA256===snapshot.publicClient.publicProgramSHA256,'corporate and all-jobs public inventory programs differ')
    snapshot.originalNativeDepartments=json(await read(base+'/departments',signal))
    // The shared reader still verifies the exact original inline entity. Only
    // its public inventory program is a source authority prerequisite.
    profile.declaration.scriptSHA256=snapshot.publicClient.originalScriptSHA256
   }
   snapshot.qualified=true
  }catch(error){signal.throwIfAborted();snapshot.issue=error.message;issues.push({stage:snapshot.phase+'-public-client',message:error.message})}
  return page
 }
 try{
  // The corporate callback includes two physical reads for Buildkite and three
  // for Tripadvisor. Its logical budget is separate from each 15-second read.
  await bounded(createNativeGreenhouseScraper(profile,{nativeReadTimeoutMs:source==='buildkite'?45000:60000}).run({signal,maxJobs:null,fetchPage,now:stamp,onAudit:a=>{nativeAudit=a}}),signal)
  requireCurrent(nativeAudit,'original native observations unavailable')
  let final={qualified:false},finalFeed=null,finalOffices=null
  try{
   const primary=await fetchPage(profile.primaryURL),board=json(await read(base));finalOffices=json(await read(base+'/offices'));finalFeed=nativeFeed(json(await read(feedURL)));officeIndex(finalOffices)
   final={qualified:primary.status===200&&snapshots.at(-1)?.qualified===true&&board.name===profile.publisherName,originalNativeBoard:board,originalNativeOffices:finalOffices,originalNativeFeed:finalFeed}
  }catch(error){signal.throwIfAborted();issues.push({stage:'final-native-listing',message:error.message})}
  const opening=nativeAudit.opening,closing=nativeAudit.closing,all=nativeAudit.observations.map(r=>structuredClone(r)),history=new Map(nativeAudit.observationHistory.map(row=>[String(row.postId),row.earlier])),finalMap=new Map((finalFeed?.jobs||[]).map(row=>[String(row.id),row]))
  let inventoryQualified=opening?.qualified===true&&closing?.qualified===true&&final.qualified&&snapshots.length===3&&snapshots.every(s=>s.qualified)
  for(const phase of[opening,closing]){try{nativeFeed(phase.originalNativeFeed)}catch(error){inventoryQualified=false;issues.push({stage:'native-listing-envelope',message:error.message})}}
  inventoryQualified=inventoryQualified&&same(feedModel(opening.originalNativeFeed),feedModel(closing.originalNativeFeed))&&same(feedModel(closing.originalNativeFeed),feedModel(finalFeed))&&same(opening.originalNativeOffices,closing.originalNativeOffices)&&same(closing.originalNativeOffices,finalOffices)
  if(source==='tripadvisor'){
   for(const snapshot of snapshots){
    const value=snapshot.originalNativeDepartments,ids=new Set(),feed=closing?.originalNativeFeed?.jobs||[],expected=feed.filter(row=>knownPost(row)==='job').map(row=>row.id)
    let ok=value&&Object.keys(value).every(k=>k==='departments')&&Array.isArray(value.departments)&&new Set(value.departments.map(d=>d.id)).size===value.departments.length
    if(ok)for(const d of value.departments){if(!Array.isArray(d.jobs)){ok=false;break}for(const row of d.jobs){const own=feed.find(r=>r.id===row.id);ids.add(row.id);if(!own||!own.departments.some(item=>item.id===d.id)||['title','absolute_url','location'].some(k=>!same(row[k],own[k])))ok=false}}
    if(!ok||ids.size!==expected.length||expected.some(id=>!ids.has(id)))inventoryQualified=false
   }
   if(!snapshots.every(s=>same(s.originalNativeDepartments,snapshots[0].originalNativeDepartments)))inventoryQualified=false
  }
  let vacancyCount=0,prospectCount=0
  for(const row of all){
   const own=row.sourceNativeRecord,earlier=history.get(row.jobId),current=finalMap.get(row.jobId),kind=knownPost(own||row.sourceNativeListingRecord)
   row.sourceNativePostKind=kind;if(kind==='job')vacancyCount++;else if(kind==='prospect')prospectCount++
   const failures=[]
   let qualified=Boolean(row.sourceNativeDetailQualified&&row.sourceCurrentNativePostingIdentityQualified&&earlier?.sourceNativeDetailQualified&&earlier.sourceCurrentNativePostingIdentityQualified&&same(model(earlier.sourceNativeRecord),model(own))&&current&&same(model(current),model(row.sourceNativeListingRecord)))
   if(!qualified)failures.push('opening-closing-full-native-model-or-final-membership-unqualified')
   if(own&&(!Object.keys(own).every(k=>nativeFields.has(k))||typeof own.content!=='string'||!row.jobDescription||/^(?:Please enter job description|Job description coming soon)[.!]?$/i.test(nativeHTMLText(own.content))||own.first_published!=null&&!row.postingDate||own.application_deadline!=null&&!row.closingDate)){qualified=false;failures.push('public-native-role-criteria-or-publisher-date-unreviewed-or-missing')}
   const publicCriteriaComplete=qualified
   const country=own&&row.sourceNativeDetailQualified?reviewNativeWorkCountry(own,closing.originalNativeOffices,source):{indiaScope:'unknown',proof:null,reason:'native-own-public-detail-unqualified'}
   const firstCountry=earlier?.sourceNativeRecord&&earlier.sourceNativeDetailQualified?reviewNativeWorkCountry(earlier.sourceNativeRecord,opening.originalNativeOffices,source):{indiaScope:'unknown',proof:null}
   if(country.indiaScope!==firstCountry.indiaScope||!same(country.proof?.bindingSHA256,firstCountry.proof?.bindingSHA256)){qualified=false;failures.push('own-public-country-proof-changed')}
   row.sourcePublicWorkCountryProof=country.proof;row.sourcePublicIndiaScope=country.indiaScope
   if(kind==='job'&&!['india','foreign'].includes(country.indiaScope)){qualified=false;failures.push(country.reason||'native-work-country-unresolved')}
   if(kind==='unresolved'){qualified=false;failures.push('native-post-kind-unresolved')}
   row.sourceConfiguredBoardRoleQualified=qualified;row.sourcePublicRoleHolds=failures;row.sourceDetailComplete=Boolean(row.sourceNativeDetailQualified&&publicCriteriaComplete);row.sourceCompanyWideScopeComplete=false;row.lifecycleCleanupAllowed=false
  }
  const complete=Boolean(inventoryQualified&&all.length===closing?.nativePostIds?.length&&all.every(row=>row.sourceConfiguredBoardRoleQualified)),selected=all.filter(row=>row.sourceNativePostKind==='job'&&row.sourceConfiguredBoardRoleQualified&&row.sourcePublicIndiaScope==='india')
  const chosen=maxJobs&&selected.length>maxJobs?selected.slice(0,maxJobs):selected,jobs=chosen.map(row=>({...row,country:'India',sourceCountryScopeUnresolved:false,sourceDescription:row.sourceNativeRecord.content,sourceListingComplete:complete&&chosen.length===selected.length,sourceDeclaredBoardScopeComplete:complete&&chosen.length===selected.length,sourceScopeComplete:false,scrapedAt:startedAt}))
  const completedAt=stamp(),evidence={status:complete&&chosen.length===selected.length?(vacancyCount===0?'verified-empty':'complete-inventory'):'coverage-gap',surface:feedURL,firstParty:responses.some(r=>r.status===200),listingComplete:complete&&chosen.length===selected.length,pagesFetched:responses.filter(r=>r.status===200).length,reportedTotal:complete?vacancyCount:null,indiaFacetCount:complete?selected.length:null,verifiedAt:completedAt,
   reason:'current-configured-public-board;full-native-own-models-and-final-post-detail-native-listing;public-JD-workplace-proofs;company-wide-totals-and-cleanup-unverified'+(complete?'':';native-country-criteria-or-inventory-gap')}
  const audit={source,startedAt,completedAt,observations:all,nativeVacancyCount:vacancyCount,nativeProspectCount:prospectCount,sourceSnapshots:snapshots,final,nativeAudit,responses,issues,inventoryEvidence:evidence,configuredBoardComplete:complete,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  Object.defineProperty(jobs,'sourceAudit',{value:audit});attachSourceObservationEvidence(jobs,{source,recordKind:prospectCount?'mixed':'vacancy-rows',observedRecordCount:all.length,observedVacancyCount:vacancyCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});attachInventoryEvidence(jobs,evidence)
  if(options.onAudit)await bounded(Promise.resolve().then(()=>options.onAudit(structuredClone(audit))),signal)
  signal.throwIfAborted();return jobs
 }finally{clearTimeout(timer)}
}})
