import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {parse} from 'acorn'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const source='cultfit',company='Cult.fit',companyId=15470,domain='careers.cult.fit'
const shell='https://careers.cult.fit/cult/',api='https://public.zwayam.com/'
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right)
const need=(value,message)=>{if(!value)throw Object.assign(Error('[cultfit] current publication: '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')

export function parseCultfitPage(payload){
 const data=payload?.data,config=data?.facetedSearchConfig
 need(payload?.code===200&&data&&Array.isArray(data.data)&&Number.isSafeInteger(data.totalCount)&&data.totalCount>=0&&data.totalCount<=1000
  &&typeof data.hasMoreData==='boolean'&&String(config?.companyId)===String(companyId)&&config.domain===domain,'native listing envelope or employer scope unavailable')
 const pageSize=Number(config.paginationHowMuch)
 need(Number.isSafeInteger(pageSize)&&pageSize>0&&pageSize<=100&&data.data.length<=pageSize&&data.data.length<=data.totalCount,'native page count unavailable')
 const records=data.data.map(row=>{
  const record=row?._source
  need(record&&Number.isSafeInteger(record.id)&&record.id>0&&String(row._id)===String(record.id)&&record.companyId===companyId
   &&norm(record.jobTitle)&&/^[a-z0-9][a-z0-9._~-]*$/i.test(record.jobUrl??'')
   &&(record.careerSiteUrl==null||record.careerSiteUrl===domain),'native wrapper, posting or company identity unavailable')
  return record
 })
 return{records,total:data.totalCount,hasMore:data.hasMoreData,pageSize}
}

function publicationDates(row,now){
 const expiries=[],publications=[]
 for(const key of ['endtDate','endDate','validThrough','valid_through','applicationDeadline','application_deadline','closingDate','closing_date','expiryDate','expirationDate']){
  const value=row[key];if(value==null||value==='')continue
  const raw=typeof value==='number'&&Number.isSafeInteger(value)?new Date(value).toISOString():value
  const date=nativeDate(raw,{required:true})
  need(date.exact?Date.parse(date.iso)>now.getTime():date.iso.slice(0,10)>=now.toISOString().slice(0,10),'native role expired: '+key)
  expiries.push({field:key,raw:value,...date})
 }
 for(const key of ['datePosted','postingDate','published_at','publishedDate','publication_date']){
  const value=row[key];if(value==null||value==='')continue
  const date=nativeDate(value,{required:true});need(Date.parse(date.iso)<=now.getTime(),'native publication date in future')
  publications.push({field:key,...date})
 }
 if(row.startDate!=null&&row.startDate!==''){
  const raw=typeof row.startDate==='number'?new Date(row.startDate).toISOString():row.startDate
  need(Date.parse(nativeDate(raw,{required:true}).iso)<=now.getTime(),'native publication window not started')
 }
 expiries.sort((a,b)=>a.iso.localeCompare(b.iso));publications.sort((a,b)=>a.iso.localeCompare(b.iso))
 return{postingDate:publications[0]?.raw??null,closingDate:expiries[0]?.raw??null,
  sourceNativePublicationDates:publications,sourceNativeExpiryDates:expiries,
  sourceNativeDateFields:Object.fromEntries(['createDate','createdDate','jobCreatedDate','modifiedDate','startDate','endtDate'].map(key=>[key,row[key]??null])),
  sourceNativeDateLimits:'Internal creation, modification and requisition approval dates are retained without asserting a public first-posted date.'}
}

const employerMatches=value=>typeof value==='string'&&norm(value).toLowerCase()==='cult.fit'
function qualifyAdditionalSignals(value,now){
 for(const key of ['companyName','employer','legalEmployer'])if(value[key]!=null&&value[key]!=='')
  need(employerMatches(typeof value[key]==='string'?value[key]:value[key]?.name),'explicit native employer conflict: '+key)
 if(value.hiringOrganization!=null)need(employerMatches(typeof value.hiringOrganization==='string'?value.hiringOrganization:value.hiringOrganization?.name),'explicit native hiring organization conflict')
 for(const key of ['country','countryCode','country_code','countryName','workCountry','addressCountry'])
  if(value[key]!=null&&value[key]!=='')need(nativeCountryName(value[key])==='India','native explicit country conflict: '+key)
 for(const key of ['location','locAgg','locationDisplayForManageJobs','locationSeparatedbySlash','officeLocation']){
  const country=nativeLocationCountryName(value[key]);need(!country||country==='India','native workplace country conflict: '+key)
 }
 for(const key of ['isClosed','closed','isExpired','expired','isArchived','archived','disabled'])
  if(value[key]!=null)need(value[key]===false,'native availability contradicts publication: '+key)
 for(const key of ['isActive','canApply','isPosted','isPublished'])
  if(value[key]!=null)need(value[key]===true,'native availability unavailable: '+key)
 const criteria=[value.shortDescription,value.role,...Object.values(value.jobConfigurationData??{})].filter(v=>typeof v==='string').join('\n')
 const doc=readNativeDocument(criteria),blocks=doc.nodes(n=>['p','li','b','strong','h1','h2','h3','h4'].includes(n.tag)).map(doc.text)
 need(!findExplicitNativeClosure(blocks),'native authored role explicitly closed')
 for(const block of blocks){
  const country=/^(?:(?:job|work|workplace)\s+)?country\s*:\s*(.+)$/i.exec(block)
  if(country)need(nativeCountryName(country[1])==='India','native criteria country conflict')
  const workplace=/^(?:(?:job|work)\s+)?(?:location|workplace)\s*[:\-]\s*(.+)$/i.exec(block)
  if(workplace){const country=nativeLocationCountryName(workplace[1]);need(!country||country==='India','native criteria workplace country conflict')}
  const employer=/^(?:employer|legal employer|hiring organization|company(?: name)?)\s*:\s*(.+)$/i.exec(block)
  if(employer)need(employerMatches(employer[1]),'native criteria employer conflict')
 }
 const configuredLocation=value.jobConfigurationData?.Location
 if(configuredLocation!=null){const country=nativeLocationCountryName(configuredLocation);need(!country||country==='India','native displayed workplace country conflict')}
 if(value.jobLocationRecord!=null){
  need(Array.isArray(value.jobLocationRecord),'native additional address list malformed')
  for(const address of value.jobLocationRecord)need(address.jobId===value.id&&address.companyId===companyId&&nativeCountryName(address.country)==='India','native additional address identity/country conflict')
 }
 return publicationDates(value,now)
}

export function projectCultfitPublishedRole(row,{now=new Date()}={}){
 need(now instanceof Date&&Number.isFinite(now.getTime()),'observation clock invalid')
 need(row?.companyId===companyId&&Number.isSafeInteger(row.id)&&row.id>0&&norm(row.jobTitle)&&norm(row.jobCode)
  &&/^[a-z0-9][a-z0-9._~-]*$/i.test(row.jobUrl??''),'native role identity invalid')
 need(row.status===1&&row.displayStatus==='Open'&&row.jobType==='J'&&row.isCompanyLive===1,'native role not published Open')
 need(row.privateJobShare==null||row.privateJobShare==='N','native private-only publication')
 const dates=qualifyAdditionalSignals(row,now)
 for(const key of ['isClosed','closed','isExpired','expired','isArchived','archived','disabled'])
  if(row[key]!=null)need(row[key]===false,'native availability contradicts publication: '+key)
 for(const key of ['isActive','canApply','isPosted','isPublished'])
  if(row[key]!=null)need(row[key]===true,'native availability unavailable: '+key)
 for(const key of ['jobStatus','postingStatus','publicationStatus'])
  if(row[key]!=null)need(['Open','Active','Published'].includes(row[key]),'native status contradicts publication: '+key)
 const addresses=row.jobLocationRecord
 need(Array.isArray(addresses)&&addresses.length>0&&addresses.length<=32,'native job-country records unavailable')
 for(const address of addresses){
  need(address?.jobId===row.id&&address.companyId===companyId&&Number.isSafeInteger(address.id)&&address.id>0
   &&nativeCountryName(address.country)==='India'&&norm(address.location)&&norm(address.formattedLocation)
   &&nativeLocationCountryName(address.formattedLocation)==='India','native scoped address/country conflict')
 }
 for(const key of ['country','countryCode','country_code','countryName','workCountry','addressCountry'])
  if(row[key]!=null&&row[key]!=='')need(nativeCountryName(row[key])==='India','native explicit country conflict: '+key)
 const primary=norm(row.location)
 need(primary&&primary.split(/\s*[;/|]\s*/).every(part=>addresses.some(a=>[a.city,a.location,a.formattedLocation].some(label=>norm(label).toLowerCase()===part.toLowerCase()))),'native primary workplace disagrees with scoped addresses')
 for(const key of ['locAgg','locationDisplayForManageJobs','locationSeparatedbySlash','officeLocation']){
  const country=nativeLocationCountryName(row[key]);need(!country||country==='India','native workplace country conflict: '+key)
 }
 const description=[row.shortDescription,row.role].map(value=>extractActiveDescription(value??'')).filter(Boolean).join('\n\n')||null
 need(!findExplicitNativeClosure([norm(row.jobTitle),...(description?[description]:[])]),'native role explicitly closed')
 if(description){
  const doc=readNativeDocument([row.shortDescription,row.role].filter(Boolean).join('\n'))
  for(const block of doc.nodes(n=>['p','li','b','strong','h1','h2','h3','h4'].includes(n.tag)).map(doc.text)){
   const country=/^(?:(?:job|work|workplace)\s+)?country\s*:\s*(.+)$/i.exec(block)
   if(country)need(nativeCountryName(country[1])==='India','native criteria country conflict')
  }
 }
 const url=shell+'jobview/'+encodeURIComponent(row.jobUrl)+'?id='+row.id
 return{source,company,title:norm(row.jobTitle),jobId:String(row.id),requisitionId:norm(row.referenceNumber??row.jobCode),sourceNativeJobCode:row.jobCode,
  country:'India',location:addresses.map(a=>norm(a.formattedLocation)).join(' / '),city:addresses.length===1?norm(addresses[0].city)||null:null,
  state:addresses.length===1?norm(addresses[0].state)||null:null,locations:addresses.map(a=>norm(a.formattedLocation)),
  department:norm(row.departmentName??row.DepartmentName)||null,sourceUrl:url,applyUrl:url,link:url,
  sourceDescription:description,jobDescription:description,sourceDetailComplete:false,sourceDetailFailureKind:'native-publication-qualified-full-role-criteria-and-application-controls-unverified',
  employmentType:null,experienceRequired:norm(row.experienceUIField??row.yrsOfExperience)||null,requiredSkills:[],minimumQualification:null,preferredQualification:null,
  sourceNativeRecord:row,sourceNativeCountryRecords:addresses,sourceNativeLimitedVisibilityValue:row.jobVisibiltyLevel??null,
  sourceNativePublicationStatus:{status:row.status,displayStatus:row.displayStatus,jobType:row.jobType,customStatusLabelsUsedAsPublicationState:false},
  nativeEmployerBinding:{publisher:'Cult.Fit',currentOwnSubdomainVerified:true,nativeCompanyId:companyId,legalEmployer:null},
  backendApplicationActivationVerified:false,applicationSubmitted:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  ...dates,scrapedAt:now.toISOString()}
}

function shellClient(html){
 const doc=readNativeDocument(html)
 need(doc.nodes(n=>n.tag==='title'&&norm(n.raw)==='Careers | Cult.Fit').length===1
  &&doc.nodes(n=>n.tag==='base'&&n.attrs.href==='/cult/').length===1
  &&doc.nodes(n=>n.tag==='app-root').length===1,'current own careers publisher unavailable')
 const scripts=doc.nodes(n=>n.tag==='script'&&/^main\.[a-z0-9]+\.js$/.test(n.attrs.src??''))
 need(scripts.length===1,'current native data client missing or ambiguous')
 return new URL(scripts[0].attrs.src,shell).href
}

function declaredProtocol(script){
 const ast=parse(script,{ecmaVersion:'latest'}),configs=[],literals=new Set()
 const walk=value=>{
  if(!value||typeof value!=='object')return
  if(value.type==='Literal'&&typeof value.value==='string')literals.add(value.value)
  if(value.type==='ObjectExpression'){
   const props=Object.fromEntries(value.properties.filter(p=>p.type==='Property'&&!p.computed&&p.value.type==='Literal').map(p=>[p.key.name??p.key.value,p.value.value]))
   if(Object.hasOwn(props,'COMPANYID'))configs.push(props)
  }
  for(const item of Object.values(value))if(Array.isArray(item))item.forEach(walk);else if(item&&typeof item==='object')walk(item)
 };walk(ast)
 need(configs.length===1&&configs[0].COMPANYID==='MTU0NzA='&&configs[0].DOMAIN===domain
  &&configs[0].APIENDPOINT===api&&configs[0].APIENDPOINTNEW===api,'current native employer/endpoint declaration differs')
 for(const value of ['jobs/search','jobs-service/v1/jobs/careersite','requisition_service/getReqFieldsForCareersSite','jobview/:jobUrl'])
  need(literals.has(value),'current native public protocol declaration missing: '+value)
 return{companyId,domain,api,jobRoute:'jobview/:jobUrl',nativeClientExecuted:false,wholeClientHashPinned:false}
}

function createReader(options){
 const timeout=options.timeoutMs??180000,interval=options.requestIntervalMs??1000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(interval)&&interval>=0
  &&(interval>=1000||typeof options.fetchImpl==='function'),'finite read budgets invalid')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('[cultfit] source deadline exceeded')),timeout)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const transport=options.fetchImpl??globalThis.fetch,receipts=[]
 let count=0,total=0,last=0
 const read=async(url,{body,json=false,kind='json',tenantGroupId}={})=>{
  signal.throwIfAborted();need(++count<=160,'native request cap exceeded')
  const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});last=Date.now()
  const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs:15000,overflowError:Error('[cultfit] streaming body cap exceeded'),
   request:{method:body?'POST':'GET',...(body?{body}:{})},fetchImpl:async(u,init)=>{
    const response=await transport(u,{...init,credentials:'omit',headers:{...init.headers,'User-Agent':'Mozilla/5.0',
     ...(tenantGroupId?{TenantGroupId:tenantGroupId}:{}),...(json?{'Content-Type':'application/json'}:{})}})
    need(response?.url===u&&Number.isInteger(response.status)&&response.redirected===false&&response.headers?.get&&response.body,'native HTTP redirect or metadata unavailable')
    return response
   }})
  const bytes=Buffer.from(page.bodyBase64,'base64');total+=bytes.length
  need(bytes.length<=4*1024*1024&&total<=32*1024*1024,'bounded native entity/aggregate budget exceeded')
  const text=bytes.toString('utf8');need(Buffer.from(text).equals(bytes),'native response is not valid UTF8')
  const mime=page.headers['content-type']??''
  receipts.push({url,method:body?'POST':'GET',status:page.status,contentType:mime,bytes:bytes.length,sha256:digest(bytes),bodyBase64:page.bodyBase64})
  if(page.status!==200)throw Object.assign(Error('[cultfit] native public read HTTP '+page.status),{httpStatus:page.status,nativePublicReadUnavailable:true})
  need((kind==='html'?/text\/html|application\/xhtml\+xml/:kind==='script'?/(?:java|ecma)script/:/(?:application|text)\/(?:[\w.+-]*\+)?json/).test(mime),'native MIME unavailable')
  signal.throwIfAborted();return kind==='json'?readLiteralModel(text).value:text
 }
 const wait=operation=>new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason)}
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
  Promise.resolve().then(operation).then(value=>{signal.removeEventListener('abort',abort);signal.aborted?abort():resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(signal.aborted?signal.reason:error)})
 })
 return{read,signal,receipts,wait,close:()=>{clearTimeout(timer);controller.abort()}}
}

export async function runCultfitPublication(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson,'metadata-free injected callbacks cannot qualify publications')
 const io=createReader(options),now=(options.now??(()=>new Date()))()
 need(now instanceof Date&&Number.isFinite(now.getTime()),'observation clock invalid')
 const phase=async()=>{
  const clientURL=shellClient(await io.read(shell,{kind:'html'})),protocol=declaredProtocol(await io.read(clientURL,{kind:'script'}))
  const tenant=await io.read(api+'tenant_management/tenant/group?domain_name='+domain)
  need(tenant?.responseStatus==='SUCCESS'&&tenant.responseCode===200&&tenant.reponseObject?.name==='Cult.Fit'
   &&typeof tenant.reponseObject?.tenantGroupId==='string'&&tenant.reponseObject.tenantGroupId,'native tenant employer identity unavailable')
  const tenantGroupId=tenant.reponseObject.tenantGroupId,config=await io.read(api+'data-service/v2/company/'+companyId+'/careersite-configurations',{tenantGroupId})
  const employer=config?.reponseObject?.company
  need(config.responseStatus==='SUCCESS'&&config.responseCode===200&&employer?.id===companyId&&employer.companyName==='Cult.Fit'
   &&employer.domainName===domain&&employer.careerSiteUrl===domain,'native employer/domain identity unavailable')
  const records=[],ids=new Set(),slugs=new Set();let offset=0,total=null,terminal=false
  for(let index=0;index<100;index++){
   const body=new URLSearchParams({filterCri:JSON.stringify({paginationStartNo:offset,selectedCall:'sort',sortCriteria:{name:'modifiedDate',isAscending:false},anyOfTheseWords:''}),domain,companyId:'MTU0NzA='}).toString()
   const page=parseCultfitPage(await io.read(api+'jobs/search',{body,tenantGroupId}))
   need(total===null||total===page.total,'native total changed within pagination');total=page.total
   for(const row of page.records){need(!ids.has(row.id)&&!slugs.has(row.jobUrl),'duplicate native job identity');ids.add(row.id);slugs.add(row.jobUrl);records.push(row)}
   if(!page.hasMore){need(records.length===total,'native terminal page count incomplete');terminal=true;break}
   need(page.records.length>0&&records.length<total,'native pagination made no valid progress');offset+=page.pageSize
  }
  need(terminal,'native page cap prevented terminal enumeration')
  const representatives=[]
  for(const row of records.slice(0,2)){
   const body=JSON.stringify({jobUrl:row.jobUrl,externalSource:'CAREERSITE',campusUrl:'empty',companyId:String(companyId),jobId:String(row.id)})
   try{
    const detail=await io.read(api+'jobs-service/v1/jobs/careersite',{body,json:true,tenantGroupId})
    const custom=await io.read(api+'requisition_service/getReqFieldsForCareersSite/'+row.id+'/'+companyId,{tenantGroupId})
    representatives.push({id:row.id,detail,custom})
   }catch(error){
    io.signal.throwIfAborted()
    // Native whole-list publication remains independent of an optional detail
    // read outage. Missing/malformed identity in a supplied detail is qualified
    // per role below; caller cancellation and indispensable listing reads fail.
    if(!error.nativePublicReadUnavailable&&error.name!=='TimeoutError'&&error.message!=='fetch failed')throw error
    representatives.push({id:row.id,unavailable:true,httpStatus:error.httpStatus??null,reason:error.message})
   }
  }
  return{clientURL,protocol,tenant,config,records,total,representatives}
 }
 try{
  const opening=await phase(),closing=await phase()
  need(equal(opening.protocol,closing.protocol),'closing native employer/protocol changed')
  const byId=new Map(closing.records.map(row=>[row.id,row])),held=[],jobs=[]
  for(const row of opening.records){
   try{
    need(equal(row,byId.get(row.id)),'closing whole native role model changed or disappeared')
    const job=projectCultfitPublishedRole(row,{now}),representative=opening.representatives.find(r=>r.id===row.id)
    if(representative){
     const closingRepresentative=closing.representatives.find(r=>r.id===row.id)
     const available=[representative,closingRepresentative].filter(r=>r&&!r.unavailable)
     for(const observed of available){
      const {detail,custom}=observed
      need(detail?.id===row.id&&detail.companyId===companyId&&detail.jobUrl===row.jobUrl&&norm(detail.jobTitle)===norm(row.jobTitle)
       &&String(detail.jobCode)===String(row.jobCode)&&detail.status===1&&detail.jobType==='J'
       &&(detail.privateJobShare==null||detail.privateJobShare==='N')
       &&custom?.responseStatus==='SUCCESS'&&custom.responseCode===200,'representative current native role identity/status unavailable')
      qualifyAdditionalSignals(detail,now)
     }
     if(representative.unavailable||closingRepresentative?.unavailable){
      const missing=representative.unavailable?representative:closingRepresentative
      need(![404,410].includes(missing.httpStatus),'native representative role explicitly unavailable')
      job.sourceNativeDetailObservation=missing
     }else{
      need(equal(representative,closingRepresentative),'closing whole native representative role criteria changed')
      job.sourceNativeDetailPayload=representative.detail;job.sourceNativeCustomCriteriaPayload=representative.custom
      const dates=qualifyAdditionalSignals(representative.detail,now)
      job.sourceNativeDetailPublicationDates=dates.sourceNativePublicationDates;job.sourceNativeDetailExpiryDates=dates.sourceNativeExpiryDates
      if(dates.closingDate&&(job.closingDate==null||Date.parse(dates.closingDate)<Date.parse(job.closingDate)))job.closingDate=dates.closingDate
      if(dates.postingDate&&(job.postingDate==null||Date.parse(dates.postingDate)<Date.parse(job.postingDate)))job.postingDate=dates.postingDate
     }
    }
    job.sourceNativeClosingRecord=byId.get(row.id);job.sourceClosingQualified=true;jobs.push(job)
   }catch(error){held.push({id:row.id,reason:error.message,originalRecord:row,closingRecord:byId.get(row.id)??null})}
  }
  for(const row of closing.records)if(!opening.records.some(old=>old.id===row.id))held.push({id:row.id,reason:'new-at-closing-not-independently-qualified',closingRecord:row})
  const audit={source,openingRecords:opening.records,closingRecords:closing.records,openingRepresentatives:opening.representatives,closingRepresentatives:closing.representatives,
   openingTenant:opening.tenant,closingTenant:closing.tenant,openingConfiguration:opening.config,closingConfiguration:closing.config,
   openingClientURL:opening.clientURL,closingClientURL:closing.clientURL,protocol:opening.protocol,originalResponses:io.receipts,heldNativeRows:held,
   currentOwnPublishedFeedEnumerated:true,nativeReportedTotal:opening.total,companyScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,
   fullCriteriaIndiaJobs:0,partialCriteriaIndiaJobs:jobs.length,lifecycleCleanupAllowed:false,backendApplicationActivationVerified:false,applicationSubmitted:false,
   limits:['Full detail criteria and application controls remain unverified for the published inventory.','Native custom Hidden/Closed labels are retained without overriding current typed status1/displayStatusOpen.','Company-wide inventory and cleanup are unproven.']}
  const selected=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(selected,{source,recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(selected,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit)await io.wait(()=>options.onAudit(structuredClone(audit)))
  io.signal.throwIfAborted()
  return attachInventoryEvidence(selected,{status:'coverage-gap',surface:shell,firstParty:true,pagesFetched:io.receipts.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:now.toISOString(),
   reason:'current-own-public-native-published-India-records-and-closing-models-qualified;full-role-criteria-application-controls-company-totals-and-cleanup-held'})
 }finally{io.close()}
}
