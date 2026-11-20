import C from './catalog.js'
import {readNativeDocument,extractActiveDescription}from'../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure}from'../../scraper-support/utils/sourceAvailability.js'
import {createBoundedPublicCareerTransport}from'../../scraper-support/utils/boundedPublicCareerTransport.js'
import {attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'

const source=C.source,api=C.careersJobsApiUrl,site=C.officialJobsSiteUrl,org=C.expectedOrgId
const norm=x=>String(x??'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Industrybuying current native: '+message),{abortRetries:true})}
const municipalities=new Map([['New Delhi','https://delhi.gov.in/'],['Navi Mumbai','https://www.nmmc.gov.in/web']])
function criteria(html){
 const doc=readNativeDocument(html),blocks=doc.nodes(n=>['p','li','b','strong','h1','h2','h3','h4'].includes(n.tag)).map(doc.text)
 need(!findExplicitNativeClosure(blocks),'native role explicitly closed')
 for(const block of blocks){
  const c=/^(?:(?:work|job|workplace)\s+)?country\s*:\s*(.+)$/i.exec(block)
  if(c)need(nativeCountryName(c[1])==='India','full criteria country conflict')
  const l=/^(?:(?:work|job)\s+)?(?:location|workplace)\s*[:\-]\s*(.+)$/i.exec(block)
  if(l){const c=nativeLocationCountryName(l[1]);need(!c||c==='India','full criteria workplace country conflict')}
  const e=/^(?:company(?: name)?|employer|hiring organization|legal employer)\s*:\s*(.+)$/i.exec(block)
  if(e)need(['IndustryBuying','Industrybuying','industrybuying'].includes(e[1]),'full criteria employer conflict')
 }
}
function nativeConstraints(row,detail,observedAt){
 const now=new Date(observedAt);need(Number.isFinite(+now),'invalid availability observation date')
 const expiry=[]
 for(const[scope,object]of[['listing',row],['detail',detail]]){
  for(const field of['isActive','active','canApply','isOpen','isPublished','published'])if(object[field]!=null)need(object[field]===true,'explicit native availability conflict: '+field)
  if(object.posted!=null)need(object.posted===true||object.posted==='Y','explicit native availability conflict: posted')
  for(const field of['status','jobStatus','postingStatus','availability'])if(object[field]!=null)need(typeof object[field]==='string'&&/^(?:active|open|published|approved|posted|available|accepting applications)$/i.test(norm(object[field])),'explicit native availability conflict: '+field)
  for(const field of['country','countryCode','workCountry','workplaceCountry','locationCountry','addressCountry'])if(object[field]!=null)need(nativeCountryName(object[field])==='India','explicit native workplace country conflict')
  const locations=Array.isArray(object.jobLocation)?object.jobLocation:[object.jobLocation]
  for(const location of locations)if(location&&typeof location==='object'){
   for(const value of[location.addressCountry,location.address?.addressCountry])if(value!=null)need(nativeCountryName(value)==='India','explicit native structured workplace country conflict')
  }
  for(const field of['employer','legalEmployer','hiringOrganization','companyName','company'])if(object[field]!=null){const value=object[field],name=typeof value==='string'?value:value?.name;need(['IndustryBuying','Industrybuying','industrybuying'].includes(norm(name)),'explicit native employer conflict')}
  for(const field of['validThrough','closingDate','applicationDeadline','dateExpires'])if(object[field]!=null&&object[field]!==''){
   const value=object[field],day=typeof value==='string'?value.slice(0,10):'',calendar=/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day
   need(calendar&&(value===day||/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))),'native expiry date unqualified: '+field)
   need(value===day?day>=now.toISOString().slice(0,10):Date.parse(value)>=+now,'native role explicitly expired: '+field)
   expiry.push({scope,field,value})
  }
 }
 return expiry
}
export function industryRole(row,detail,observedAt=new Date().toISOString()){
 need(row?.orgId===org&&detail?.orgId===org&&/^job_\d+$/.test(row.id)&&/^req_\d+$/.test(row.requisitionId)
  &&detail.id===row.requisitionId&&detail.requisitionId===row.requisitionId,'own organization/requisition identity mismatch')
 need(['title','department','location','jobType'].every(k=>norm(row[k])&&norm(row[k])===norm(detail[k])),'native listing/detail identity or workplace mismatch')
 need(detail.status==='Active'&&Number.isSafeInteger(detail.openings)&&detail.openings>0&&Number.isSafeInteger(detail.filled)&&detail.filled>=0&&detail.filled<detail.openings,'native role closed or unavailable')
 need(municipalities.has(row.location),'native office workplace country unresolved')
 const expiry=nativeConstraints(row,detail,observedAt)
 need(detail.jobDescription==null||typeof detail.jobDescription==='string','native authored criteria model unqualified')
 const description=extractActiveDescription(detail.jobDescription??'');criteria(detail.jobDescription??'')
 const date=row.createdAt;need(/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date).toISOString().slice(0,10)===date,'native publication date invalid')
 return{source,title:norm(row.title),company:'IndustryBuying',nativeEmployer:'IndustryBuying',nativeLegalEmployer:null,
  jobId:row.id,requisitionId:row.requisitionId,sourceNativeHumanRequisitionId:detail.reqId??null,department:row.department,
  sourceUrl:site+'jobs/detail?id='+row.id,applyUrl:site+'jobs/apply?id='+row.id,link:site+'jobs/apply?id='+row.id,
  location:row.location,city:row.location,state:null,country:'India',sourceCountryScopeUnresolved:false,
  sourceCountryEvidence:{kind:'matching-exact-whole-native-listing-detail-municipality',label:row.location,country:'India',reference:municipalities.get(row.location)},
  sourceDescription:description,jobDescription:description,sourceRawDescriptionHtml:detail.jobDescription,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'partial',sourceDetailFailureKind:description?null:'native-authored-criteria-unavailable',publicExperienceChecked:true,
  sourceNativeListingRecord:row,sourceNativeDetailRecord:detail,nativeSourceRecord:{listing:row,detail},
  postingDate:date,closingDate:expiry[0]?.value??null,sourceNativeDates:{listingCreatedAt:row.createdAt,detailCreatedAt:detail.createdAt,recognizedExpiryFields:expiry},
  employmentType:row.jobType,experienceRequired:detail.experience??null,requiredSkills:Array.isArray(detail.skillsRequired)?detail.skillsRequired:[],minimumQualification:null,preferredQualification:null,
  sourceCompanyScopeUnresolved:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
}
function publisher(html,homepage=false){
 const doc=readNativeDocument(html)
 if(homepage)need(doc.nodes(n=>n.tag==='a'&&n.attrs.href===site&&/career/i.test(doc.text(n))).length>0,'official employer careers delegation unavailable')
 else need(doc.nodes(n=>n.tag==='title'&&norm(n.raw)==='Careers at IndustryBuying').length===1&&doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/jobs').length>0,'native employer board unavailable')
 return{url:homepage?C.officialHomepageUrl:site,ownCareersHandoffQualified:true}
}
function application(html,row){
 const doc=readNativeDocument(html),scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.src?.startsWith('/_next/static/chunks/')&&n.attrs.src.endsWith('.js')).map(n=>n.attrs.src)
 need(doc.nodes(n=>n.tag==='title'&&norm(n.raw)==='Careers at IndustryBuying').length===1&&scripts.length>0,'native application document unavailable')
 // The public application controller reads this exact id query and the same
 // native /jobs?id model. Its complete current form was independently reviewed;
 // this read qualifies the handoff, without claiming CAPTCHA/backend activation.
 return{url:site+'jobs/apply?id='+row.id,publishedJobId:row.id,ownDetailAPI:api+'?id='+row.id,requisitionId:row.requisitionId,
  nativeDeclaredClientScripts:scripts,allControlsQualified:false,activationVerified:false,submitted:false}
}
export async function runIndustryNative(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson,'metadata-free legacy callbacks cannot qualify current reads')
 const allowed=new Set([C.officialHomepageUrl,site,C.careersOrgsApiUrl,api+'?orgId='+org])
 const io=createBoundedPublicCareerTransport({...options,source,allowedURL:(u,m)=>m==='GET'&&allowed.has(u)})
 const rawPages=[],openingDetailModels=[],closingDetailModels=[],held=[],jobs=[]
 const load=async(u,json=false)=>{const value=json?await io.fetchJson(u):await io.fetchText(u);rawPages.push({url:u,...(json?{originalModel:value}:{originalHTML:value})});return value}
 const organization=async()=>{const value=await load(C.careersOrgsApiUrl,true);need(Array.isArray(value.data)&&value.data.filter(x=>x.id===org&&x.slug==='industrybuying'&&x.name==='industrybuying').length===1,'current native organization unavailable');return value}
 const inventory=async()=>{const value=await load(api+'?orgId='+org,true);need(Array.isArray(value.data)&&value.total===value.data.length&&value.data.length>0&&value.data.length<=100
  &&new Set(value.data.map(x=>x.id)).size===value.data.length,'native pagination total missing, truncated or duplicate');need(value.data.every(x=>x.orgId===org&&/^job_\d+$/.test(x.id)),'foreign or malformed native inventory identity');return value}
 try{
  const openingPublisher=publisher(await load(C.officialHomepageUrl),true),openingBoard=publisher(await load(site)),openingOrg=await organization(),opening=await inventory()
  for(const row of opening.data){
   const u=api+'?id='+row.id,app=site+'jobs/apply?id='+row.id;allowed.add(u);allowed.add(app)
   const response=await load(u,true);need(response.data&&typeof response.data==='object','native detail unavailable')
   const html=await load(app),model=application(html,row);openingDetailModels.push({listing:row,detail:response.data,application:model,originalApplicationHTML:html})
   try{const job=industryRole(row,response.data,(options.now||(()=>new Date().toISOString()))());job.sourceNativeApplication=model;jobs.push(job)}catch(error){held.push({id:row.id,message:error.message,listing:row,detail:response.data})}
  }
  const closing=await inventory();need(same(opening,closing),'native closing complete inventory differs')
  for(const old of openingDetailModels){const row=old.listing,response=await load(api+'?id='+row.id,true),html=await load(site+'jobs/apply?id='+row.id),model=application(html,row);closingDetailModels.push({listing:row,detail:response.data,application:model,originalApplicationHTML:html});need(same(old.detail,response.data)&&same(old.application,model),'native closing complete criteria/application differs');const job=jobs.find(j=>j.jobId===row.id);if(job)job.sourceClosingQualified=true}
  need(same(openingOrg,await organization())&&same(openingBoard,publisher(await load(site)))&&same(openingPublisher,publisher(await load(C.officialHomepageUrl),true)),'native closing publisher/organization differs')
  const summary={source,openingNativeRecords:opening.data,closingNativeRecords:closing.data,openingDetailModels,closingDetailModels,held,rawPages,openingOrg,openingClosingMatch:true,
   sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,applicationSubmitted:false,backendActivationVerified:false}
  const now=(options.now||(()=>new Date().toISOString()))();for(const job of jobs){nativeConstraints(job.sourceNativeListingRecord,job.sourceNativeDetailRecord,now);job.scrapedAt=now}
  const result=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(result,{source,recordKind:'vacancy-rows',observedRecordCount:opening.data.length,observedVacancyCount:opening.data.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:summary,configurable:true});await options.onAudit?.(structuredClone(summary));io.signal.throwIfAborted()
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:site,firstParty:true,pagesFetched:rawPages.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'own-active-full-native-records-and-application-handoffs-closed;exact-municipal-geography;unresolved-office-labels-and-company-inventory-held'})
 }finally{io.close()}
}
