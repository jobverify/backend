import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inspectCodemonkApplication,compareCodemonkQuestions} from './nativeApplications.js'

const CAREERS='https://codemonk.io/careers'
const fail=(ok,message)=>{if(!ok)throw Error('[codemonk] '+message)}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const text=value=>typeof value==='string'&&value.trim().length>0
const norm=value=>value.replace(/\s+/g,' ').trim()
const roleKeys=['id','uuid','slug','title','job_type','description','max_salary','min_salary','is_salary_visible','salary_type','currency','max_experience','min_experience','skill','education','seniority','industry','no_of_openings','country','location','other_locations','department_name','company_name','workplace_type','remote','published_internally','job_screening_questions','application_fields','created_at','updated_at','status','published','closed_at','apply_link','link']
const questionKeys=['uuid','name','label','question','choices','mandatory','disqualifying_value','maximum_range','minimum_range','open_range']
const inputNames=['ADDRESS','CTC','DESIGNATION','EDUCATION','EMAIL','FIRST_NAME','GENDER','LAST_NAME','LINKEDIN_URL','NOTICE_PERIOD','ONLINE_PORTFOLIO','PHONE','RESUME','TOTAL_WORK_EXPERIENCE','WORK_EXPERIENCE']
const extra=(value,keys,path,issues)=>{for(const key of Object.keys(value))if(!keys.includes(key))issues.push('unreviewed-native-field:'+path+'.'+key)}
const finiteJSON=value=>{
 if(typeof value==='number')fail(Number.isFinite(value)&&(!Number.isInteger(value)||Number.isSafeInteger(value)),'unsafe native numeric criteria')
 if(value&&typeof value==='object')for(const child of Object.values(value))finiteJSON(child)
}
const nativeDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return false
 const day=value.slice(0,10);return new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day
}
const countryNames=new Map(),displayNames=new Intl.DisplayNames(['en'],{type:'region'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=displayNames.of(code)
 if(name&&name!==code&&!['ZZ','EU','UN','XA','XB','QO'].includes(code)){countryNames.set(name.toLowerCase(),code);countryNames.set(code.toLowerCase(),code)}
}

export async function readCurrentCodemonk({fetchText,signal,onAudit=()=>{}}){
 signal?.throwIfAborted()
 const html=await fetchText(CAREERS,{signal});signal?.throwIfAborted()
 fail(typeof html==='string','native document unavailable')
 const document=readNativeDocument(html),frames=document.nodes(node=>node.tag==='script'&&node.raw?.trim().startsWith('self.__next_f.push('))
 const rawFrames=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(([,body])=>body.trim().startsWith('self.__next_f.push('))
 fail(frames.length>0&&frames.length===rawFrames.length&&frames.every(node=>Object.keys(node.attrs).length===0),'unreviewed/inactive literal Flight activation')
 const titles=document.nodes(node=>node.tag==='title')
 fail(titles.length===1&&norm(titles[0].raw||'')==='Find Your Dream Career-Codemonk','native publisher title changed')
 const records=readLiteralFlightRecords(html);fail(records instanceof Map,'literal native records unavailable')
 const scopes=[]
 const walk=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value.departments))scopes.push(value);for(const child of Object.values(value))walk(child)}
 for(const record of records.values())if(record.kind==='model')walk(record.value)
 fail(scopes.length===1,'ambiguous native department model')
 const scope=scopes[0],globalIssues=[];extra(scope,['departments'],'model',globalIssues);finiteJSON(scope)
 const native=[]
 for(const department of scope.departments){
  fail(plain(department)&&text(department.name)&&Array.isArray(department.jobs),'invalid native department')
  const issues=[...globalIssues];extra(department,['name','jobs'],'department',issues)
  for(const row of department.jobs)native.push({row,department:department.name,issues})
 }
 const resolve=(reference,seen=new Set())=>{
  fail(typeof reference==='string'&&/^\$[\da-f]+$/i.test(reference),'unreviewed description reference')
  const id=reference.slice(1);fail(!seen.has(id),'cyclic native description reference');seen.add(id)
  const record=records.get(id);fail(record&&typeof record.value==='string','native description reference is not text')
  if(record.kind==='text')return record.value
  fail(record.kind==='model'&&/^\$[\da-f]+$/i.test(record.value),'unreviewed native description control token')
  return resolve(record.value,seen)
 }
 const visible=readVisibleNativeDocument(html,{strict:true}),rendered=new Map()
 for(const anchor of visible.nodes(node=>node.tag==='a'&&node.attrs.href)){
  let url;try{url=new URL(anchor.attrs.href,CAREERS)}catch{continue}
  if(url.origin!=='https://codemonk.io')continue
  const match=url.pathname.match(/^\/careers\/[^/]+-([A-F\d]{10})\/?$/i);if(!match)continue
  fail(!url.username&&!url.password&&!url.search&&!url.hash,'ambiguous corporate role URL')
  const headings=[]
  const visit=node=>{if(node.inert)return;if(node.tag==='div'&&['font-bold','text-secondary'].every(name=>String(node.attrs.class||'').split(/\s+/).includes(name)))headings.push(node);for(const child of node.children||[])if(typeof child!=='string')visit(child)}
  visit(anchor);fail(headings.length===1&&text(visible.text(headings[0])),'corporate role lacks one dedicated visible title')
  const id=match[1].toUpperCase(),prior=rendered.get(id),title=visible.text(headings[0])
  fail(!prior||(prior.href===anchor.attrs.href&&prior.title===title),'conflicting corporate role identity')
  rendered.set(id,{href:anchor.attrs.href,url:url.href,title})
 }
 fail(rendered.size>0,'no visible corporate vacancy binding')
 const seen=new Set(),jobs=[],nativeJobs=[],criteriaUnknownIds=[],countryUnknownIds=[]
 for(const item of native){
  signal?.throwIfAborted()
  const raw=item.row,issues=[...item.issues]
  fail(plain(raw)&&typeof raw.id==='string'&&/^[A-F\d]{10}$/.test(raw.id)&&raw.uuid===raw.id&&!seen.has(raw.id)&&text(raw.title)&&raw.company_name==='CODEMONK','invalid/foreign native role identity')
  seen.add(raw.id);nativeJobs.push(structuredClone(raw));extra(raw,roleKeys,'role',issues)
  fail(raw.published===true&&raw.status==='open'&&raw.closed_at===null&&raw.published_internally===false,'native role is not an open public vacancy')
  fail(text(raw.slug)&&/^[a-z\d]+(?:-[a-z\d]+)*$/.test(raw.slug),'invalid native slug')
  for(const [field,suffix] of [['link',''],['apply_link','/apply']]){
   let url;try{url=new URL(raw[field])}catch{fail(false,'invalid native application URL')}
   fail(url.origin==='https://jobs.pyjamahr.com'&&!url.username&&!url.password&&url.pathname===`/codemon/${raw.slug}${suffix}`&&url.search==='?source=DIRECT'&&!url.hash,'foreign native application tenant/role')
  }
  const card=rendered.get(raw.id)
  if(card)fail(norm(card.title)===norm(raw.title),'native title differs from dedicated rendered title')
  fail(text(raw.country)&&text(raw.location)&&Array.isArray(raw.other_locations),'invalid native country/location shape')
  const country=countryNames.get(raw.country.toLowerCase()),labelCountry=countryNames.get(raw.location.split(',').at(-1).trim().toLowerCase())
  fail(!country||!labelCountry||country===labelCountry,'native country/location contradiction')
  if(!country||raw.other_locations.length){issues.push('unreviewed-native-country-alternatives');countryUnknownIds.push(raw.id)}
  fail(text(raw.department_name)&&text(raw.job_type)&&text(raw.workplace_type)&&typeof raw.remote==='boolean','invalid native employment/workplace')
  if(raw.department_name!==item.department)issues.push('native-department-model-mismatch')
  if(!['FULLTIME','INTERN'].includes(raw.job_type)||raw.workplace_type!=='ON_SITE')issues.push('unreviewed-native-employment')
  fail(!(raw.workplace_type==='ON_SITE'&&raw.remote),'native workplace contradiction')
  for(const field of ['skill','education','seniority'])fail(Array.isArray(raw[field])&&raw[field].every(text),'invalid native '+field)
  for(const field of ['min_salary','max_salary','min_experience','max_experience'])fail(raw[field]===null||typeof raw[field]==='number'&&Number.isFinite(raw[field])&&raw[field]>=0,'invalid native numeric '+field)
  for(const [minimum,maximum] of [['min_salary','max_salary'],['min_experience','max_experience']])fail(raw[minimum]===null||raw[maximum]===null||raw[minimum]<=raw[maximum],'inverted native criteria range')
  fail(typeof raw.is_salary_visible==='boolean'&&text(raw.salary_type)&&text(raw.currency)
   &&(raw.no_of_openings===null||Number.isSafeInteger(raw.no_of_openings)&&raw.no_of_openings>0),'invalid native compensation/openings')
  if(!['ANNUAL','MONTHLY'].includes(raw.salary_type)||raw.currency!=='INR'||raw.industry!==null)issues.push('unreviewed-native-compensation-industry')
  fail(Array.isArray(raw.job_screening_questions)&&Array.isArray(raw.application_fields),'native application criteria unavailable')
  for(const q of raw.job_screening_questions){
   fail(plain(q)&&text(q.uuid)&&text(q.name)&&text(q.label)&&text(q.question)&&typeof q.mandatory==='boolean'&&Array.isArray(q.choices)&&q.choices.every(text),'invalid mandatory screening schema')
   extra(q,questionKeys,'screening',issues)
   if(!['multi_choice','multi_line_text','single_text','yes_no_option'].includes(q.name)||['disqualifying_value','maximum_range','minimum_range','open_range'].some(key=>q[key]!==null))issues.push('unreviewed-native-screening-contract')
  }
  for(const field of raw.application_fields){
   fail(plain(field)&&text(field.name)&&text(field.input_type)&&text(field.label)&&typeof field.mandatory==='boolean'&&(field.placeholder===null||typeof field.placeholder==='string'),'invalid mandatory application schema')
   extra(field,['name','input_type','label','placeholder','mandatory'],'application',issues)
   if(!inputNames.includes(field.name)||!['ADDRESS','CTC','EMAIL','FILE','PHONE','ROW','SELECT','TEXT'].includes(field.input_type))issues.push('unreviewed-native-application-contract')
  }
  if(!nativeDate(raw.created_at)||!nativeDate(raw.updated_at))issues.push('unreviewed-native-creation-edit-date')
  const description=resolve(raw.description),jd=readVisibleNativeDocument(description,{strict:true}),jdRoot=jd.nodes(node=>node.tag==='root')[0]
  const visibleDescription=jd.text(jdRoot),active=extractActiveDescription(description)
  const completeDescription=Boolean(active&&visibleDescription&&norm(active)===norm(visibleDescription)&&!/<(?:script|style|template|iframe|object|noscript)\b|<[^>]*\b(?:hidden|inert|aria-hidden)\b/i.test(description))
  if(!completeDescription)issues.push('native-visible-description-unreviewed')
  if(issues.length)criteriaUnknownIds.push(raw.id)
  if(country!=='IN')continue
  jobs.push({jobId:raw.uuid,requisitionId:null,title:raw.title,sourceNativeTitle:raw.title,sourceRenderedTitle:card?.title??null,sourceRenderedIdentityVerified:Boolean(card),
   company:'Codemonk',sourcePublisher:raw.company_name,legalHiringEmployer:null,source:'codemonk',country:'India',location:raw.location,sourceUrl:raw.link,applyUrl:raw.apply_link,link:raw.apply_link,
   department:raw.department_name,employmentType:raw.job_type,remoteStatus:raw.workplace_type==='ON_SITE'?'On-site':null,requiredSkills:structuredClone(raw.skill),minimumQualification:null,preferredQualification:null,experienceRequired:null,
   postingDate:null,closingDate:null,sourceNativeCreatedAt:raw.created_at,sourceNativeUpdatedAt:raw.updated_at,sourceNativeRecord:structuredClone(raw),sourceNativeDescription:description,
   sourceNativeEducation:structuredClone(raw.education),sourceScreeningQuestions:structuredClone(raw.job_screening_questions),sourceApplicationFields:structuredClone(raw.application_fields),
   jobDescription:visibleDescription||null,sourceDescription:visibleDescription||null,sourceListingDescriptionComplete:completeDescription,sourceCriteriaIssues:issues,sourceDetailComplete:issues.length===0&&completeDescription,
   sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,sourceGlobalJobCount:null,scrapedAt:new Date().toISOString()})
 }
 // Corporate serialization can lag the actual native application. Retain both
 // complete originals and their differences instead of presenting stale
 // mandatory screening questions as complete current criteria.
 const nativeApplications=[]
 let cursor=0
 const readApplication=async()=>{
  while(cursor<jobs.length){
   const index=cursor++,job=jobs[index],corporate=job.sourceNativeRecord
   const listingCriteriaComplete=job.sourceDetailComplete
   job.sourceCorporateScreeningQuestions=structuredClone(corporate.job_screening_questions)
   job.sourceCorporateApplicationFields=structuredClone(corporate.application_fields)
   job.sourceNativeApplicationActivationVerified=false
   job.sourceDetailComplete=false
   job.sourceDeclaredCriteriaCopyComplete=false
   let application,body=null
   try{
    signal?.throwIfAborted()
    body=await fetchText(corporate.apply_link,{signal});signal?.throwIfAborted()
    application=inspectCodemonkApplication(body,corporate)
   }catch(error){
    signal?.throwIfAborted()
    application={sourceURL:corporate.apply_link,originalNativeHTML:body,rawPageProps:null,bound:false,schemaComplete:false,selectedFields:[],
     schemaIssues:['native-application-unavailable'],error:{name:error.name,code:error.code??null,message:error.message}}
   }
   job.sourceNativeApplication=application
   job.sourceCriteriaDifferences=[]
   const props=application.rawPageProps
   if(props&&typeof props==='object'){
    job.sourceNativeApplicationFieldDefinitions=structuredClone(props.applicationFormFields??null)
    job.sourceNativeJobApplicationFields=structuredClone(props.jobApplicationFormFields??null)
   }
   if(application.bound){
    const current=props.jobDetails
    job.sourceNativeCurrentRecord=structuredClone(current)
    if(Array.isArray(current.job_screening_questions)){
     job.sourceScreeningQuestions=structuredClone(current.job_screening_questions)
     job.sourceCriteriaDifferences=compareCodemonkQuestions(corporate.job_screening_questions,current.job_screening_questions)
    }
    job.sourceApplicationFields=structuredClone(application.selectedFields)
    const nativeCountry=typeof current.country==='string'?countryNames.get(current.country.toLowerCase()):null
    const corporateCountry=countryNames.get(corporate.country.toLowerCase())
    const countryConsistent=Boolean(nativeCountry&&nativeCountry===corporateCountry&&application.countryLocationConsistent!==false)
    if(!countryConsistent){
     job.country=null;job.location=null;job.locations=[];job.city=null;job.state=null
     job.sourceCountryScopeUnresolved=true
     countryUnknownIds.push(job.jobId);job.sourceCriteriaIssues.push('native-corporate-role-country-unresolved')
    }
    job.sourceDeclaredCriteriaCopyComplete=listingCriteriaComplete&&application.schemaComplete&&countryConsistent
   }
   job.sourceCriteriaIssues.push(...application.schemaIssues,'native-application-activation-and-conditional-controls-unqualified')
   criteriaUnknownIds.push(job.jobId)
   nativeApplications[index]={jobId:job.jobId,...application}
  }
 }
 await Promise.all(Array.from({length:Math.min(3,jobs.length)},readApplication))
 signal?.throwIfAborted()
 const audit={source:'codemonk',originalNativeHTML:html,literalFlightRecords:structuredClone([...records]),nativeDepartments:structuredClone(scope.departments),nativeJobs,
  nativeApplications,declaredNativeCriteriaCopies:jobs.filter(job=>job.sourceDeclaredCriteriaCopyComplete).length,
  renderedRoleIds:[...rendered.keys()],unrenderedNativeRoleIds:[...seen].filter(id=>!rendered.has(id)),unreconciledEmployerRoleIds:[...rendered.keys()].filter(id=>!seen.has(id)),criteriaUnknownIds:[...new Set(criteriaUnknownIds)],countryUnknownIds:[...new Set(countryUnknownIds)],
  observedNativeRecords:nativeJobs.length,observedIndiaRecords:jobs.length,sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,noClosingProof:true,currentLiveQualification:false,
  missingProofs:['native renderer/pagination and all corporate hiring channels','all native account/public detail/employer proof','fresh opening/closing cohort and criteria','native application activation and conditional-control behavior']}
 Object.defineProperty(jobs,'sourceAudit',{value:audit});await onAudit(structuredClone(audit));signal?.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:'discovery-only',surface:CAREERS,firstParty:false,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'codemonk-native-eight-role-criteria-retained-renderer-pagination-employer-and-closing-scope-unresolved'})
}
