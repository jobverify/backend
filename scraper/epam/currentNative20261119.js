import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nodeText,countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {qualifyCurrentEpamModel} from './currentModel20261113.js'
import {currentEpamProgram,inspectCurrentEpamContext,verifyCurrentEpamProgram} from './currentProgram20261119.js'
import {createNativeReader,mapOriginalRoles} from './currentTransport20261119.js'
export const SOURCE='epam',COMPANY='EPAM',INDEX='https://careers.epam.com/en/jobs/india'
const INDIA='4060741400035606931',ORIGIN='https://careers.epam.com'
const fail=message=>Object.assign(Error('EPAM current own publication: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const sha=value=>createHash('sha256').update(value).digest('hex')
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item)
function nextModel(html){
 const doc=readNativeDocument(html),root=one(doc.nodes(n=>n.tag==='root'),'native document')
 need(!doc.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'Unreviewed native navigation')
 const script=one(doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json'),'active original Next data')
 const parsed=readLiteralModel(script.raw)
 need(parsed.validJSON&&parsed.rawControlCharacters.length===0,'Malformed original native model')
 return {doc,root,next:parsed.value}
}
function ownRole(record){
 need(record&&typeof record==='object'&&!Array.isArray(record)&&typeof record.uid==='string'&&/^blt[a-zA-Z0-9]+$/.test(record.uid)
  &&record.tenant==='epamgdo'&&record.locale==='en-us'&&record.unique_id===record.tenant+'_'+record.uid+'_'+record.locale
  &&typeof record.name==='string'&&norm(record.name)&&record.name.length<=2000,'Native own role UID, tenant or title invalid')
 need(typeof record.seo?.url==='string','Native own role URL missing')
 const url=new URL(record.seo.url,INDEX)
 need(url.origin===ORIGIN&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/en\/vacancy\/[^/]+$/.test(url.pathname)
  &&url.pathname.endsWith('-'+record.uid+'_en'),'Native role URL is foreign or disagrees with UID')
 return url.href
}
export function parseCurrentIndex(html){
 const {doc,next}=nextModel(html),props=next.props?.pageProps
 need(next.page==='/jobs/[slug]'&&next.query?.slug==='india'&&props?.canonicalPath===INDEX
  &&props.jobs&&Array.isArray(props.jobs.jobs)&&Number.isSafeInteger(props.jobs.total)&&props.jobs.total>=props.jobs.jobs.length,'Native India SSR discovery context changed')
 const records=props.jobs.jobs
 need(records.length>0&&records.length<=10&&new Set(records.map(r=>r.unique_id)).size===records.length,'Native first discovery cohort absent, excessive or duplicated')
 const controller=one(doc.nodes(n=>n.tag==='script'&&n.attrs.src?.includes('/pages/jobs/')),'current native discovery renderer')
 need(new URL(controller.attrs.src,INDEX).href==='https://careers.epam.com/_next/static/chunks/pages/jobs/%5Bslug%5D-7fdaa81dfe49924f.js','Current native discovery renderer changed')
 return records.map(r=>({sourceUrl:ownRole(r),title:r.name,nativeRecord:r}))
}
function originalDate(raw,label){
 need(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)
  &&Number.isFinite(Date.parse(raw))&&new Date(raw.slice(0,10)).toISOString().slice(0,10)===raw.slice(0,10),'Malformed native '+label+' date')
 return {raw,ms:Date.parse(raw),lastMs:Date.parse(raw)+(raw.length===10?86399999:0)}
}
function qualifyPublication(record,observedAt){
 const now=Date.parse(observedAt);need(Number.isFinite(now),'Invalid native observation clock')
 ownRole(record)
 need(record.hiring_type==='vacancy'&&record.posting_type==='Standard'&&record.is_hidden===false&&record.is_expired===false
  &&Array.isArray(record.environments)&&record.environments.includes('careers')&&record.application_type==='full-self-service',
 'Native role is not a current public own vacancy/application')
 need(Array.isArray(record.country)&&record.country.length>0&&record.country.every(c=>c?.id===INDIA&&c.name==='India'
  &&(c.type==null||c.type==='Country')),'Native countries are foreign, mixed or unknown')
 need(Array.isArray(record.city)&&record.city.every(c=>norm(c?.name)&&c.country?.id===INDIA&&c.country.name==='India'
  &&(c.country.type==null||c.country.type==='Country')),'Native city country is foreign or unknown')
 need(Array.isArray(record.metadata?.country)&&record.metadata.country.length>0&&record.metadata.country.every(c=>c.id===INDIA&&c.title==='India'),'Native country metadata contradicts scope')
 for(const localized of Object.values(record.i18n??{})){
  need(Array.isArray(localized.country)&&localized.country.length>0&&localized.country.every(c=>c.split('#')[0]===INDIA),'Native localized country contradicts India')
  need(Array.isArray(localized.city)&&localized.city.every(value=>{const [country,state,city]=value.split('#');return country===INDIA&&record.city.some(c=>c.id===city&&c.state?.id===state)}),'Native localized city country disagrees')
 }
 need(record.relocation===false&&Array.isArray(record.relocation_destination)&&record.relocation_destination.length===0,'Native relocation destination scope unqualified')
 for(const key of ['countryCode','country_code','addressCountry'])if(record[key]!=null&&record[key]!=='')need(countryName(record[key])==='India','Additional native country contradicts India')
 for(const key of ['status','jobStatus','publication_status'])if(record[key]!=null&&record[key]!=='')need(/^(?:open|active|published)$/i.test(record[key]),'Additional native publication is not current')
 for(const key of ['isClosed','closed','expired','disabled','archived'])if(record[key]!=null)need(record[key]===false||record[key]===0,'Additional native application unavailable')
 for(const key of ['isActive','isPublished','canApply'])if(record[key]!=null)need(record[key]===true||record[key]===1,'Additional native application disabled')
 const deadlines=[],publications=[]
 for(const key of ['validThrough','application_deadline','applicationDeadline','closingDate','expiryDate'])if(record[key]!=null&&record[key]!==''){
  const value=originalDate(record[key],'deadline');need(value.lastMs>=now,'Native authored deadline expired');deadlines.push({field:key,...value})
 }
 for(const key of ['created_at','updated_at','datePosted','postingDate','published_at'])if(record[key]!=null&&record[key]!==''){
  const value=originalDate(record[key],'publication/update');need(value.ms<=now,'Native publication/update is future');publications.push({field:key,...value})
 }
 need(publications.some(p=>p.field==='created_at'),'Native authored date context absent')
 return {deadlines,publications}
}
export function parseCurrentRole(html,listing,observedAt){
 const record=listing.nativeRecord,dates=qualifyPublication(record,observedAt)
 need(listing.sourceUrl===ownRole(record)&&listing.title===record.name,'Native discovered role identity disagrees')
 const context=inspectCurrentEpamContext({html,sourceUrl:listing.sourceUrl,nativeRecord:record})
 const {doc}=nextModel(html)
 need(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='https://www.epam.com/careers').length>0,'Own corporate careers identity absent')
 const control=one(doc.nodes(n=>n.attrs.id==='cta_job_apply_unauthorized'),'public own Apply control')
 need(!/\b(?:closed|expired|filled)\s*(?:[-:\u2013\u2014]|$)/i.test(record.name),'Native role title explicitly closed')
 let full=null,criteriaFailure=null
 try{full=qualifyCurrentEpamModel(record)}catch(error){criteriaFailure=error.message}
 const missingCriteria=[...(Array.isArray(record.benefits)?record.benefits:[]).map((original,index)=>({kind:'benefits',index,original})),...(Array.isArray(record.disclaimers)?record.disclaimers:[]).map((original,index)=>({kind:'disclaimers',index,original}))]
  .map(row=>({...row,reason:'native-location-specific-terms-renderer-not-independently-qualified'}))
 const coreVisible=context.criteriaMarkupQualified&&typeof record.text==='string'&&norm(record.text).length>100
 const complete=Boolean(full&&coreVisible&&missingCriteria.length===0)
 const originals=dates.publications.map(p=>({field:p.field,raw:p.raw}))
 originals.push({field:'own-role-JobPosting.datePosted',raw:context.nativeJobPosting.datePosted})
 const posting=originals.map(p=>p.raw).filter(raw=>Number.isFinite(Date.parse(raw))).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]??null
 return {jobId:record.uid,requisitionId:record.uid,nativeUniqueId:record.unique_id,title:record.name,sourceUrl:listing.sourceUrl,
  applyUrl:listing.sourceUrl,nativeApplicationURL:listing.sourceUrl,nativeApplicationType:'in-page-current-own-role-apply-control',
  sourceNativeApplicationControl:{tag:control.tag,attrs:{...control.attrs},text:nodeText(control)},sourceApplicationWorkflowScope:'anonymous-current-role-control-only;authenticated-wizard-and-backend-unverified',
  nativeEmployerDisplayName:COMPANY,sourceLegalEmployer:null,country:'India',city:record.city.length===1?record.city[0].name:null,
  state:record.city.length===1?record.city[0].state?.name??null:null,location:[...new Set(record.city.map(c=>c.name)),'India'].join('; '),
  sourceNativeCountries:record.country,sourceNativeCities:record.city,sourceCountryScopeUnresolved:false,
  remoteStatus:({Office:'On-site',Remote:'Remote',Hybrid:'Hybrid'})[record.vacancy_type]??null,
  postingDate:posting,closingDate:dates.deadlines.sort((a,b)=>a.lastMs-b.lastMs)[0]?.raw??null,
  sourceNativePublicationDates:originals,sourceNativeExpiryDates:dates.deadlines,
  sourcePublicationDatePolicy:'earliest-actually-authored-original-calendar-or-timestamp-for-aging;all-carriers-retained;first-publication-and-update-semantics-unresolved',
  sourceNativeGeneratedSchemaValidity:{raw:context.nativeJobPosting.validThrough,origin:'pinned-current-native-JobPosting-producer:created_at-plus-one-year',authoredApplicationDeadline:false},
  jobDescription:complete?full.jobDescription:coreVisible?record.text:null,sourceDescription:complete?full.jobDescription:coreVisible?record.text:null,
  sourceDescriptionHTML:record.description??null,sourceDetailComplete:complete,
  sourceMissingCriteria:missingCriteria,sourceNativeModelCriteriaText:full?.jobDescription??null,
  sourceDetailFailureKind:complete?null:criteriaFailure??context.criteriaFailure??(missingCriteria.length?'native-location-specific-criteria-renderer-unverified':'native-criteria-unavailable'),
  sourceNativeRecord:record,sourceNativeOwnRoleRecord:context.nativeRecord,sourceNativeJobPosting:context.nativeJobPosting,
  sourceNativeContextFingerprint:context.fingerprint,sourceNativeCmsContext:{staticData:context.nativeCmsModel,commonCmsProps:context.nativeCommonCmsProps,otherPageProps:context.nativeOtherPageProps},
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false}
}
export async function runCurrentNative(options={}){
 need(options.maxJobs==null,'Truncated native observations unsupported')
 const controllerURL='https://careers.epam.com/_next/static/chunks/pages/jobs/%5Bslug%5D-7fdaa81dfe49924f.js'
 const files=[{url:currentEpamProgram.appURL,mime:'application/javascript',sha256:currentEpamProgram.appSha256},...currentEpamProgram.programAndStyleFiles]
 const reader=createNativeReader(SOURCE,[INDEX,controllerURL,...files.map(f=>f.url)],options)
 try{
  const observedAt=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString()
  const opening=await reader.read(INDEX),listings=parseCurrentIndex(opening.body),openingRecords=listings.map(r=>r.nativeRecord)
  for(const row of listings)reader.allow(row.sourceUrl)
  const passes=[]
  for(const phase of ['opening','closing']){
   const resources=new Map()
   for(const file of files){const resource=await reader.read(file.url,file.mime==='text/css'?'css':'javascript');need(sha(resource.body)===file.sha256,'Current native program or styling bytes changed');resources.set(file.url,resource.body)}
   const controller=await reader.read(controllerURL,'javascript');need(sha(controller.body)==='de15cb592f37827f806eab5cb9fa0ecaf88263914d741aa81ee24a678e1d5b12','Current native discovery renderer bytes changed')
   const facts=await mapOriginalRoles(listings,async row=>{
    const page=await reader.read(row.sourceUrl),fact=parseCurrentRole(page.body,row,observedAt)
    const verified=await verifyCurrentEpamProgram({html:page.body,sourceUrl:row.sourceUrl,nativeRecord:row.nativeRecord,read:async url=>{need(resources.has(url),'Unbound native resource');return resources.get(url)}})
    need(verified.programsAndStylesRechecked===true&&verified.fingerprint===fact.sourceNativeContextFingerprint,'Native own role context changed during qualification')
    return fact
   })
   passes.push({phase,facts,resources:files.map(f=>({url:f.url,sha256:f.sha256}))})
  }
  const [first,last]=passes
  need(canonical(first.facts)===canonical(last.facts),'Closing own native criteria, dates, employer, country or application context changed')
  const final=await reader.read(INDEX),closingListings=parseCurrentIndex(final.body)
  need(canonical(closingListings)===canonical(listings),'Closing current native discovery cohort changed')
  const jobs=first.facts.map((r,index)=>({...r,source:SOURCE,company:COMPANY,link:r.applyUrl,scrapedAt:observedAt,
   sourceNativeClosingRecord:last.facts[index].sourceNativeOwnRoleRecord,sourceClosingReconciled:true,
   companyCareerPage:INDEX,companyDomain:'epam.com',atsPlatform:'official-company-careers'}))
  const audit={source:SOURCE,recoveryKind:'current-own-native-SSR-discovery-and-individually-qualified-role-contexts',recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,
   observedNativeRecords:openingRecords,closingNativeRecords:closingListings.map(r=>r.nativeRecord),returnedRows:jobs.length,nativeIndiaCountryMatches:jobs.length,
   nativeOpeningClosingRecordsMatch:true,fullCriteriaRecovered:jobs.every(r=>r.sourceDetailComplete),fullCriteriaIndiaJobs:jobs.filter(r=>r.sourceDetailComplete).length,
   missingCriteriaJobs:jobs.filter(r=>!r.sourceDetailComplete).length,currentOwnProgramAndStyleFiles:files,backendApplicationActivationVerified:false,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
   sourcePaginationHold:'current-first-SSR-discovery-cohort-only;additional-native-pages-and-company-scope-unproven',...reader.stats()}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:INDEX,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:audit.sourcePaginationHold})
  need(Buffer.byteLength(JSON.stringify(jobs))<=16*1024*1024,'Native output exceeds bound');reader.check();return jobs
 }finally{reader.close()}
}
