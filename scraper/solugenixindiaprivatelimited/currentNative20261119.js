import {createHash} from 'node:crypto'
import C from './catalog.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {createBoundedPublicCareerTransport} from '../../scraper-support/utils/boundedPublicCareerTransport.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'

const source=C.source,program='https://jobsapi.ceipal.com/APISource/v2/js/app.min.js'
const programHash='2c235e5d12feec06de217835a02aebe542b32e7f302ffd7884711a915b5d35a6'
const norm=x=>String(x??'').replace(/\s+/g,' ').trim()
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Solugenix current native: '+message),{abortRetries:true})}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const hash=x=>createHash('sha256').update(x).digest('hex')
const wrappers=['apply_job','apply_job_login','easy_apply_job_login_hc']
function wrapper(value,key){
 const u=new URL(value)
 need(u.origin==='https://candidateportal.ceipal.com'&&!u.username&&!u.password&&!u.search&&!u.hash,'native application wrapper authority changed')
 const match=key==='easy_apply_job_login_hc'?/^\/job-details\/[A-Za-z0-9_-]{43}$/:/^\/login\/[A-Za-z0-9_-]{43}\/[A-Za-z0-9_-]{43}$/
 need(match.test(u.pathname),'native application wrapper route changed')
 return u.origin+(key==='easy_apply_job_login_hc'?'/job-details/[generated-wrapper]':'/login/[generated-wrapper]/[generated-wrapper]')
}
export function solugenixStableModel(record){
 const projected=structuredClone(record)
 for(const key of wrappers)if(Object.hasOwn(projected,key))projected[key]=wrapper(projected[key],key)
 return projected
}
const detailURL=row=>C.ceipalJobPostingsApiBaseUrl+row.id+'/?from_career_portal=1&cp_id='+C.ceipalCareerPortalId
function guardCriteria(html){
 const doc=readNativeDocument(html),blocks=doc.nodes(n=>['p','li','div','b','strong','h1','h2','h3','h4'].includes(n.tag)).map(doc.text).filter(Boolean)
 need(!findExplicitNativeClosure(blocks),'native role explicitly closed')
 for(const block of blocks){
  const country=/^(?:(?:workplace|work|job)\s+)?country\s*:\s*(.+)$/i.exec(block)
  if(country)need(nativeCountryName(country[1])==='India','full native criteria country conflict')
  const workplace=/^(?:(?:work|job)\s+)?(?:workplace|location)\s*[:\-]\s*(.+)$/i.exec(block)
  if(workplace){const country=nativeLocationCountryName(workplace[1]);need(!country||country==='India','full native criteria workplace country conflict')}
  const employer=/^(?:hiring organization|legal employer|employer|company(?: name)?)\s*:\s*(.+)$/i.exec(block)
  if(employer)need(['Solugenix','Solugenix Corporation','Solugenix India Private Limited'].includes(employer[1]),'full native criteria employer conflict')
  const residence=/^(?:candidates?|applicants?|you|employees?)\s+(?:must|are required to)\s+(?:currently\s+)?(?:be\s+)?(?:reside|live|work|based)\s+in\s+(.+?)[.!]?$/i.exec(block)
  if(residence){const country=nativeCountryName(residence[1]);need(!country||country==='India','full native criteria residence conflict')}
 }
}
export function solugenixRole(row,detail){
 need(row&&typeof row.id==='string'&&/^[A-Za-z0-9_-]{43}=$/.test(row.id)&&norm(row.job_code),'native role identity unavailable')
 need(row.country==='India'&&detail.country==='India','native role country conflict')
 need(detail.job_code===row.job_code&&norm(detail.public_job_title)===norm(row.public_job_title),'native role title or requisition identity differs')
 need(detail.company_url==='www.solugenix.com','native company publisher differs')
 need(typeof detail.terms_and_conditions==='string'&&extractActiveDescription(detail.terms_and_conditions)?.includes('provided by Solugenix Corporation'),'native portal provider declaration unavailable')
 need(detail.apply_with_out_registration===1&&detail.apply_now===0,'native public application handoff changed')
 solugenixStableModel(detail);wrapper(row.apply_job_login,'apply_job_login')
 need(detail.apply_job===detail.apply_job_login,'same native detail application targets disagree')
 need(detail.form_fields&&Array.isArray(detail.form_fields.standard_fields)&&Array.isArray(detail.form_fields.custom_fields)
  &&Array.isArray(detail.form_fields.submission_fields)&&Array.isArray(detail.form_fields.document_fields)&&Array.isArray(detail.job_posting_questions),'complete native application definition unavailable')
 for(const key of ['firstname','lastname','email','mobile_number'])need(detail.form_fields.standard_fields.filter(f=>f.key===key&&f.is_required===1).length===1,'required native application field unavailable')
 const description=extractActiveDescription(detail.public_job_desc),excerpt=extractActiveDescription(row.public_job_desc)
 need(description&&description.length>300&&description.length>(excerpt?.length||0)&&!description.endsWith('...'),'full authored description unavailable')
 need(Array.isArray(detail.display_job_view_fields)&&detail.show_job_summary===0,'unreviewed additional native criteria presentation')
 guardCriteria(detail.public_job_desc)
 need(Number.isSafeInteger(detail.number_of_positions)&&detail.number_of_positions>0,'native role positions closed or unavailable')
 const fields=detail.display_job_view_fields.filter(f=>norm(f.value)).map(f=>norm(f.label)+': '+norm(f.value))
 const full=[description,...fields].join('\n\n')
 return{source,title:norm(detail.public_job_title),company:'Solugenix',nativeEmployer:'Solugenix',nativeLegalEmployer:null,
  configuredCompanyName:C.companyName,sourceNativePortalProvider:'Solugenix Corporation',sourceCompanyScopeUnresolved:false,
  sourceCompanyLegalEntityUnresolved:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  jobId:row.id,requisitionId:detail.job_code,sourceUrl:detailURL(row),applyUrl:detail.apply_job_login,link:detail.apply_job_login,
  sourceDescription:full,jobDescription:full,sourceDetailComplete:true,publicExperienceChecked:true,
  country:'India',city:null,state:null,location:norm(detail.multpile_job_location)||null,sourceCountryScopeUnresolved:false,
  sourceCountryEvidence:{kind:'matching-original-native-feed-and-whole-own-detail-country',feedCountry:row.country,detailCountry:detail.country},
  sourceNativeListingRecord:row,sourceNativeDetailRecord:detail,sourceRawDescriptionHtml:detail.public_job_desc,
  postingDate:null,closingDate:null,sourceNativeDates:{modified:detail.modified??null,updated:row.updated??null,postingDatePublished:false},
  experienceRequired:norm(detail.experience)||null,requiredSkills:[],minimumQualification:null,preferredQualification:null,employmentType:null,remoteStatus:null,
  sourceNativeApplication:{originalForm:detail.form_fields,originalQuestions:detail.job_posting_questions,originalPublicApplyURL:detail.apply_job_login,activationVerified:false,submissionVerified:false}}
}
function authority(landing,portal,widget){
 const a=readNativeDocument(landing),p=readNativeDocument(portal),w=readNativeDocument(widget)
 need(a.nodes(n=>n.tag==='a'&&n.attrs.href===C.companyCareerPage).length>0,'current official jobs handoff unavailable')
 const scripts=p.nodes(n=>n.tag==='script'&&n.attrs.src===C.ceipalWidgetScriptUrl)
 need(scripts.length===1&&scripts[0].attrs['data-ceipal-api-key']===C.ceipalApiKey&&scripts[0].attrs['data-ceipal-career-portal-id']===C.ceipalCareerPortalId,'current own CEIPAL portal binding changed')
 need(w.nodes(n=>n.tag==='script'&&new URL(n.attrs.src||'.',C.ceipalWidgetUrl).href===program).length===1,'current native full-detail client declaration changed')
 return{corporateLink:C.companyCareerPage,widget:C.ceipalWidgetUrl,scriptAttributes:scripts[0].attrs,program}
}
export async function runSolugenixNative(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson,'metadata-free legacy callbacks cannot qualify current reads')
 const allowed=new Set([C.careersLandingUrl,C.companyCareerPage,C.ceipalWidgetUrl,program]),detailURLs=new Set()
 const headers={Accept:'application/json, text/plain, */*','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Origin:'https://jobsapi.ceipal.com',Referer:C.ceipalWidgetUrl,'X-Requested-With':'XMLHttpRequest'}
 const body=page=>new URLSearchParams({page:String(page),api_key:C.ceipalApiKey,method:'CareerPortalJobPostings',cp_id:C.ceipalCareerPortalId,from_career_portal:'1'})
 const io=createBoundedPublicCareerTransport({...options,source,allowedURL:(u,m,b)=>m==='GET'&&(allowed.has(u)||detailURLs.has(u))||m==='POST'&&[1,2,3,4,5,6,7,8,9,10].some(page=>u===C.ceipalJobPostingsApiBaseUrl+'?page='+page&&String(b)===String(body(page)))})
 const rawPages=[],openingDetailModels=[],closingDetailModels=[],held=[],jobs=[]
 const load=async(u,kind='html',init)=>{const v=kind==='json'?await io.fetchJson(u,init):kind==='js'?await io.fetchScript(u,init):await io.fetchText(u,init);rawPages.push({url:u,kind,...(kind==='json'?{originalModel:v}:{html:v,sha256:hash(v)})});return v}
 const readAuthority=async()=>{
  const landing=await load(C.careersLandingUrl),portal=await load(C.companyCareerPage),widget=await load(C.ceipalWidgetUrl)
  const model=authority(landing,portal,widget);need(hash(await load(program,'js'))===programHash,'whole native full-detail program changed');return model
 }
 const inventory=async()=>{
  let pages=1,count=null;const records=[],models=[]
  for(let page=1;page<=pages;page++){
   const u=C.ceipalJobPostingsApiBaseUrl+'?page='+page,x=await load(u,'json',{method:'POST',headers,body:body(page)})
   need(Array.isArray(x.results)&&Number.isSafeInteger(x.count)&&x.count>0&&x.count<=200&&Number.isSafeInteger(x.num_pages)&&x.num_pages>0&&x.num_pages<=10,'native pagination envelope unavailable')
   if(count===null){count=x.count;pages=x.num_pages}
   need(x.count===count&&x.num_pages===pages&&x.page_number===page&&x.page_count===x.results.length&&x.limit===20,'native pagination count drift')
   need(x.next===(page<pages?C.ceipalJobPostingsApiBaseUrl+'?page='+(page+1):null)
    &&x.previous===(page>1?C.ceipalJobPostingsApiBaseUrl+'?page='+(page-1):null),'native pagination links incomplete')
   records.push(...x.results);models.push(x)
  }
  need(records.length===count,'native pagination inventory truncated')
  const identities=new Map()
  for(const row of records){
   need(row&&typeof row.id==='string','native inventory identity unavailable')
   if(identities.has(row.id))need(same(solugenixStableModel(identities.get(row.id)),solugenixStableModel(row)),'contradictory duplicate native identity')
   else identities.set(row.id,row)
  }
  // The current public pages repeat one identical foreign identity. Retain
  // every original row and its count; this is not a unique company inventory.
  return{records,models,uniqueRecords:[...identities.values()],duplicateNativeRows:records.length-identities.size}
 }
 const detailHeaders={Accept:'text/html, */*; q=0.01','Content-Type':'application/json',Origin:'https://jobsapi.ceipal.com',Referer:C.ceipalWidgetUrl}
 try{
  const openingAuthority=await readAuthority(),opening=await inventory()
  for(const row of opening.uniqueRecords)if(row.country==='India'){
   need(/^[A-Za-z0-9_-]{43}=$/.test(row.id),'native detail identity malformed');const u=detailURL(row);detailURLs.add(u)
   const detail=await load(u,'json',{headers:detailHeaders});openingDetailModels.push({id:row.id,url:u,originalModel:detail})
   try{jobs.push(solugenixRole(row,detail))}catch(error){held.push({id:row.id,message:error.message,originalDetail:detail})}
  }
  const closing=await inventory();need(same(opening.records.map(solugenixStableModel),closing.records.map(solugenixStableModel)),'native closing complete inventory differs')
  for(const model of openingDetailModels){
   const detail=await load(model.url,'json',{headers:detailHeaders});closingDetailModels.push({id:model.id,url:model.url,originalModel:detail})
   need(same(solugenixStableModel(model.originalModel),solugenixStableModel(detail)),'native closing whole criteria/application record differs')
   const job=jobs.find(j=>j.jobId===model.id);if(job){solugenixRole(closing.records.find(r=>r.id===model.id),detail);job.sourceClosingQualified=true;job.sourceNativeClosingDetailRecord=detail}
  }
  const closingAuthority=await readAuthority();need(same(openingAuthority,closingAuthority),'native closing company/portal binding differs')
  const summary={source,openingNativeRecords:opening.records,closingNativeRecords:closing.records,openingPaginationModels:opening.models,closingPaginationModels:closing.models,
   openingAuthority,closingAuthority,openingDetailModels,closingDetailModels,held,rawPages,openingClosingMatch:true,
   sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,configuredCompanyName:C.companyName,
   nativePublisher:'Solugenix',portalTermsProvider:'Solugenix Corporation',configuredRegionalLegalEmployerUnresolved:true,applicationSubmitted:false,
   duplicateNativeRows:opening.duplicateNativeRows,nativeUniqueInventoryComplete:false}
  const now=(options.now||(()=>new Date().toISOString()))();need(Number.isFinite(Date.parse(now)),'invalid observation clock');for(const job of jobs)job.scrapedAt=now
  const result=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(result,{source,recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:summary,configurable:true});await options.onAudit?.(structuredClone(summary));io.signal.throwIfAborted()
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:C.companyCareerPage,firstParty:true,pagesFetched:rawPages.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'whole-native-India-criteria-and-public-application-definition-qualified;configured-regional-legal-company-and-total-inventory-held'})
 }finally{io.close()}
}
