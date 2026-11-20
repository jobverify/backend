import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {decodeHTML} from 'entities'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const HOMEPAGE_URL='https://www.kbr.com/en'
export const CAREERS_LANDING_URL='https://careers.kbr.com/us/en'
export const CURRENT_JOBS_URL='https://jobs.kbr.com/jobs.html'
export const SNAPSHOT_URL='https://jobs.kbr.com/data/kbr-jobs.json'
export const WORKABLE_WIDGET_URL='https://apply.workable.com/api/v1/widget/accounts/kbr'
export const WORKDAY_JOBS_API_URL='https://kbr.wd5.myworkdayjobs.com/wday/cxs/kbr/KBR_Careers/jobs'
const SOURCE='kbr',fail=message=>firstPartyFailure(SOURCE,'Current own publication: '+message)
const need=(ok,message)=>{if(!ok)throw fail(message)}
const same=(a,b)=>canonicalNativeRecord(a)===canonicalNativeRecord(b)
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const text=node=>node.children.map(child=>typeof child==='string'?child:text(child)).join(' ')
const norm=value=>decodeHTML(String(value)).replace(/\s+/g,' ').trim()
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
 &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value

function originalJSON(body){
 let value,ast
 try{value=JSON.parse(body);ast=parse('('+body+')',{ecmaVersion:'latest'})}catch{throw fail('malformed native JSON')}
 const visit=node=>{
  if(node.type==='ObjectExpression'){
   const names=new Set()
   for(const property of node.properties){
    const name=property.key?.value
    need(property.type==='Property'&&!property.computed&&property.kind==='init'&&typeof name==='string'
     &&!['__proto__','constructor','prototype'].includes(name)&&!names.has(name),'duplicate or unsafe native JSON field')
    names.add(name);visit(property.value)
   }
  }else if(node.type==='ArrayExpression')node.elements.forEach(visit)
  else need(node.type==='Literal'||node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='Literal','native JSON literal shape changed')
 }
 visit(ast.body[0].expression);return value
}
function ownLink(html,label,host){
 const document=readNativeDocument(html),urls=new Set()
 for(const node of document.nodes(node=>node.tag==='a'&&!node.inert&&typeof node.attrs.href==='string')){
  if(norm(text(node))!==label)continue
  let url;try{url=new URL(node.attrs.href)}catch{continue}
  if(url.protocol==='https:'&&url.hostname===host&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash)urls.add(url.href)
 }
 need(urls.size===1,'native '+label+' employer handoff is absent or ambiguous');return [...urls][0]
}
function ownCurrentBoard(html,base){
 const links=readNativeDocument(html).nodes(node=>node.tag==='a'&&!node.inert&&typeof node.attrs.href==='string')
 need(links.some(node=>{try{return new URL(node.attrs.href,base).href===CURRENT_JOBS_URL}catch{return false}}),
  'native full current job board navigation is missing')
 return CURRENT_JOBS_URL
}
function declaredFeeds(html,boardURL){
 const declarations=new Map(),document=readNativeDocument(html)
 for(const script of document.nodes(node=>node.tag==='script'&&!node.inert&&!node.attrs.src&&(!node.attrs.type||node.attrs.type==='text/javascript'))){
  let program;try{program=parse(script.raw,{ecmaVersion:'latest'})}catch{continue}
  for(const statement of program.body)if(statement.type==='VariableDeclaration')for(const declaration of statement.declarations){
   if(!['JOBS_DATA_URL','WORKABLE_WIDGET_URL'].includes(declaration.id?.name))continue
   need(declaration.init?.type==='Literal'&&typeof declaration.init.value==='string'&&!declarations.has(declaration.id.name),
    'native published feed declaration is ambiguous')
   declarations.set(declaration.id.name,new URL(declaration.init.value,boardURL).href)
  }
 }
 need(declarations.get('JOBS_DATA_URL')===SNAPSHOT_URL&&declarations.get('WORKABLE_WIDGET_URL')===WORKABLE_WIDGET_URL,
  'native board no longer declares the own jobs feed and companion account')
 return declarations
}
function snapshot(body,observedAt){
 const data=originalJSON(body)
 need(object(data)&&data.source==='workday_raas'&&Array.isArray(data.jobs)&&data.jobs.length<=10000
  &&Number.isSafeInteger(data.total_jobs)&&data.jobs.length===data.total_jobs,'native snapshot inventory shape/count changed')
 need(validDate(data.generated_at)&&Date.parse(data.generated_at)<=Date.parse(observedAt)
  &&Date.parse(observedAt)-Date.parse(data.generated_at)<=72*60*60*1000,'native snapshot refresh date is invalid, future or stale')
 const ids=new Set()
 for(const row of data.jobs){
  need(object(row)&&typeof row.id==='string'&&/^R\d+$/.test(row.id)&&!ids.has(row.id),'duplicate or malformed native requisition identity')
  ids.add(row.id)
 }
 return data
}
function originalDate(raw,label){
 if(validDate(raw))return {raw,ms:Date.parse(raw),latestMs:Date.parse(raw)+86400000-1,precision:'day;native-timezone-unpublished'}
 need(typeof raw==='string'&&validDate(raw.slice(0,10))
  &&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(raw)
  &&Number.isFinite(Date.parse(raw)),'native '+label+' date is malformed')
 return {raw,ms:Date.parse(raw),latestMs:Date.parse(raw),precision:'original-explicit-timezone'}
}
function availability(row,observedAt){
 const observed=Date.parse(observedAt),expiries=[],publications=[]
 for(const key of ['country','countryCode','country_code','countryName','country_name','addressCountry'])if(row[key]!=null&&row[key]!=='')
  need(nativeCountryName(row[key])==='India'||row[key]==='IND','native explicit country authority contradicts India')
 for(const key of ['publication_status','publicationStatus','posting_status','postingStatus','job_status','jobStatus'])if(row[key]!=null&&row[key]!=='')
  need(typeof row[key]==='string'&&/^(?:open|active|published|posted|approved|accepting applications)$/i.test(row[key]),'native additional publication status is unavailable or inactive')
 for(const key of ['is_active','isActive','isPublished','is_published','isPosted','is_posted','canApply','acceptingApplications','applicationOpen'])if(row[key]!=null)
  need(row[key]===true||row[key]===1||typeof row[key]==='string'&&/^(?:true|yes|y|1)$/i.test(row[key]),'native publication/application availability is disabled or unqualified')
 for(const key of ['closed','isClosed','is_closed','expired','isExpired','is_expired','withdrawn','isWithdrawn','disabled','is_disabled','archived','isArchived'])if(row[key]!=null)
  need(row[key]===false||row[key]===0||typeof row[key]==='string'&&/^(?:false|no|n|0)$/i.test(row[key]),'native publication/application is closed, expired or disabled')
 for(const key of ['validThrough','valid_through','application_deadline','applicationDeadline','closingDate','closing_date','expiryDate','expirationDate','endDate','end_date'])if(row[key]!=null&&row[key]!==''){
  const value=originalDate(row[key],'deadline');need(value.latestMs>=observed,'native application deadline is expired');expiries.push({field:key,...value})
 }
 for(const key of ['datePosted','postingDate','posted_at','published_at','publishedDate','publication_date'])if(row[key]!=null&&row[key]!==''){
  const value=originalDate(row[key],'publication');need(value.ms<=observed,'native publication date is in the future');publications.push({field:key,...value})
 }
 return {closingDate:expiries.slice().sort((a,b)=>a.latestMs-b.latestMs)[0]?.raw??null,
  postingDate:publications.slice().sort((a,b)=>a.ms-b.ms)[0]?.raw??null,expiries,publications}
}
function qualify(row,observedAt){
 need(typeof row.title==='string'&&norm(row.title)&&row.title.length<=2000,'native role title unavailable')
 need(row.requisition_status==='Open','native requisition publication is not Open')
 need(!/\b(?:position\s+closed|job\s+closed|role\s+closed|no longer available)\b/i.test(row.title),'native role is explicitly closed')
 need(!/^\s*(?:[\[(]\s*)?(?:closed|filled|expired)(?:\s*[\]):]|\s*[-\u2013\u2014:])/i.test(row.title),'native role has an explicit closed title marker')
 need(typeof row.location==='string'&&/^[^;|\r\n]+,\s*India$/.test(row.location),'native role country is not explicit India')
 const location=row.location.split(',').map(value=>value.trim())
 need(location.length>=2&&location.length<=3&&location[0]&&!/[\/;|&\r\n]/.test(row.location)
  &&location.slice(0,-1).every(value=>!nativeCountryName(value)||nativeCountryName(value)==='India'),
  'native single whole India workplace contains mixed or conflicting country scope')
 const originalAvailability=availability(row,observedAt)
 let url;try{url=new URL(row.application_url)}catch{throw fail('native own application is unavailable')}
 need(url.protocol==='https:'&&url.hostname==='kbr.wd5.myworkdayjobs.com'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash,
  'native application employer authority changed')
 const id=/^\/KBR_Careers\/job\/.+_(R\d+)(?:-\d+)*(?:\/apply)?\/?$/.exec(url.pathname)?.[1]
 need(id===row.id,'native application requisition identity disagrees')
 return {city:location[0],state:location.length>2?location[1]:null,applyURL:url.href,...originalAvailability}
}

function readerFor(options){
 const caller=options.signal;caller?.throwIfAborted()
 need(!(options.fetchText||options.fetchJson)||options.fetchPage||options.fetchImpl,'original HTTP metadata is required')
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000
 need(Number.isSafeInteger(sourceTimeoutMs)&&sourceTimeoutMs>0&&sourceTimeoutMs<=180000
  &&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'invalid native read deadline')
 const signal=AbortSignal.any([...(caller?[caller]:[]),AbortSignal.timeout(sourceTimeoutMs)])
 const responses=[];let decodedBytes=0
 const check=()=>{caller?.throwIfAborted();signal.throwIfAborted()}
 const admitted=url=>{
  const parsed=new URL(url)
  return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.port&&!parsed.search&&!parsed.hash
   &&(url===HOMEPAGE_URL||parsed.hostname==='careers.kbr.com'&&['/','/us/en','/overview/'].includes(parsed.pathname)
    ||parsed.hostname==='jobs.kbr.com'&&['/','/jobs.html','/data/kbr-jobs.json'].includes(parsed.pathname))||url===WORKABLE_WIDGET_URL
 }
 return {check,responses,async read(url,phase,kind){
  check();need(admitted(url)&&responses.length<24,'unbound or excessive original native request')
  const receipt={requestedUrl:url,phase,method:'GET',bodyComplete:false};responses.push(receipt)
  const page=await boundedDeclaredPublicGet(url,{signal,timeoutMs:requestTimeoutMs,overflowError:fail('native streaming entity ceiling exceeded'),fetchImpl:async(requested,init)=>{
   let response
   if(options.fetchPage){
    const original=await options.fetchPage(requested,init);check()
    need(original&&original.bodyUnavailable!==true&&Number.isInteger(original.status)&&object(original.headers)
     &&typeof original.bodyBase64==='string'&&original.bodyBase64.length<=Math.ceil(1024*1024/3)*4
     &&original.redirected===false,'original native HTTP bytes/redirect metadata unavailable')
    const bytes=Buffer.from(original.bodyBase64,'base64')
    need(bytes.toString('base64')===original.bodyBase64,'invalid original native entity encoding')
    response=new Response(bytes,{status:original.status,headers:original.headers})
    Object.defineProperty(response,'url',{value:original.url??original.finalUrl})
   }else response=await (options.fetchImpl??fetch)(requested,{...init,credentials:'omit',cache:'no-store'})
   check()
   need(response&&response.url===url&&response.redirected===false,'original native final URL or redirect authority changed')
   return response
  }})
  check();const bytes=Buffer.from(page.bodyBase64,'base64');decodedBytes+=bytes.length
  Object.assign(receipt,{url:page.url,status:page.status,headers:Object.fromEntries(Object.entries(page.headers).filter(([name])=>['content-type','location'].includes(name))),
   bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64,bodyComplete:true})
  need(bytes.length<=1024*1024&&decodedBytes<=8*1024*1024,'post-stream native entity or aggregate budget exceeded')
  if(![301,302,307,308].includes(page.status)){
   need(page.status===200,'original native HTTP '+page.status)
   need(kind==='json'?/^application\/json(?:;|$)/i.test(page.headers['content-type']??''):/^text\/html(?:;|$)/i.test(page.headers['content-type']??''),'original native MIME changed')
  }
  let body;try{body=new TextDecoder('utf8',{fatal:true}).decode(bytes)}catch{throw fail('original native entity is not UTF8')}
  return {...page,body}
 },stats:()=>({requests:responses.length,decodedBytes,sourceTimeoutMs,requestTimeoutMs,maxRequests:24,
  byteQualification:'16MiB shared hard streaming ceiling;1MiB entity/8MiB aggregate checked after each bounded response'})}
}

export async function runCurrentKbr(options={}){
 const reader=readerFor(options),phases=[],held=[]
 const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 need(options.maxJobs==null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'invalid output cap')
 const follow=async(url,phase,host)=>{
  for(let redirects=0;redirects<=3;redirects++){
   const page=await reader.read(url,phase,'html')
   if(page.status===200)return page
   need(page.headers.location,'native careers redirect has no destination')
   const next=new URL(page.headers.location,url)
   need(next.hostname===host&&next.protocol==='https:'&&!next.username&&!next.password&&!next.port&&!next.search&&!next.hash,
    'native careers redirect left own employer authority')
   url=next.href
  }
  throw fail('native careers redirect budget exceeded')
 }
 try{
  for(const phase of ['opening','closing']){
   const home=await reader.read(HOMEPAGE_URL,phase,'html');need(home.status===200,'native corporate homepage redirected')
   const careers=await follow(ownLink(home.body,'Careers','careers.kbr.com'),phase,'careers.kbr.com')
   const landing=await follow(ownLink(careers.body,'Explore KBR Jobs','jobs.kbr.com'),phase,'jobs.kbr.com')
   const board=await follow(ownCurrentBoard(landing.body,landing.url),phase,'jobs.kbr.com')
   declaredFeeds(board.body,board.url)
   const feed=snapshot((await reader.read(SNAPSHOT_URL,phase,'json')).body,observedAt)
   const companion=originalJSON((await reader.read(WORKABLE_WIDGET_URL,phase,'json')).body)
   need(companion.name==='KBR'&&Array.isArray(companion.jobs),'native companion employer account changed')
   phases.push({phase,home:home.body,careers:careers.body,jobsLanding:landing.body,board:board.body,boardURL:board.url,snapshot:feed,companion})
  }
  const [opening,closing]=phases,currentById=new Map(closing.snapshot.jobs.map(row=>[row.id,row])),qualified=[]
  const unlinkedIndiaRows=opening.snapshot.jobs.filter(row=>typeof row.location==='string'&&row.location.endsWith(', India')&&!row.application_url)
  for(const row of opening.snapshot.jobs){
   const current=currentById.get(row.id)
   try{
    const location=qualify(row,observedAt);need(current,'native requisition is absent at closing');qualify(current,observedAt)
    need(same(row,current),'whole native requisition changed at closing')
    qualified.push({source:SOURCE,company:'KBR',title:norm(row.title),jobId:row.id,requisitionId:row.id,
     country:'India',location:row.location,city:location.city,state:location.state,department:row.department??null,
     employmentType:row.employment_type??null,remoteStatus:row.is_remote==='Yes'?'Remote':row.is_remote==='No'?'On-site':null,
     sourceUrl:location.applyURL,applyUrl:location.applyURL,link:location.applyURL,nativeApplicationURL:location.applyURL,
     postingDate:location.postingDate,closingDate:location.closingDate,sourceNativeSnapshotRefreshDate:opening.snapshot.generated_at,
     sourceNativePublicationDates:location.publications,sourceNativeExpiryDates:location.expiries,
     sourceDescription:null,jobDescription:null,sourceDetailComplete:false,sourceDetailFailureKind:'native-criteria-not-observed',
     sourceNativeRecord:row,sourceNativeClosingRecord:current,sourceClosingReconciled:true,
     nativeEmployerBinding:{publisher:'KBR',corporateHomepage:HOMEPAGE_URL,currentOwnCareersHandoffVerified:true,legalEmployer:null},
     backendApplicationActivationVerified:false,applicationSubmitted:false,sourceScopeComplete:false,sourceListingComplete:false,
     lifecycleCleanupAllowed:false,scrapedAt:observedAt,companyCareerPage:opening.boardURL,companyDomain:'kbr.com',atsPlatform:'workday'})
   }catch(error){reader.check();held.push({jobId:row.id,reason:error.message,openingRecord:row,closingRecord:current??null})}
  }
  for(const row of closing.snapshot.jobs)if(!opening.snapshot.jobs.some(original=>original.id===row.id))
   held.push({jobId:row.id,reason:'new native requisition at closing',openingRecord:null,closingRecord:row})
  const jobs=options.maxJobs==null?qualified:qualified.slice(0,options.maxJobs)
  const audit={source:SOURCE,recordKind:'vacancy-rows',openingSnapshot:opening.snapshot,closingSnapshot:closing.snapshot,
   observations:phases,heldNativeRows:held,unlinkedIndiaRows,qualifiedObservedRoles:qualified.length,
   originalResponses:reader.responses,reader:reader.stats(),sourceScopeComplete:false,companyScopeComplete:false,
   companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,lifecycleCleanupAllowed:false,
   fullCriteriaIndiaJobs:0,partialCriteriaIndiaJobs:qualified.length,backendApplicationActivationVerified:false,applicationSubmitted:false,
   holds:['native rich criteria and original posting dates unavailable','companion jobs not hydrated','whole-company inventory and cleanup unverified','backend application activation unverified']}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.snapshot.jobs.length,
   observedVacancyCount:opening.snapshot.jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SNAPSHOT_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:reader.responses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'current-own-public-linked-india-requisitions-and-full-native-records-reconciled;criteria-dates-company-scope-and-cleanup-held'})
  await options.onAudit?.(structuredClone(audit));reader.check();return jobs
 }catch(error){
  reader.check()
  try{Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,phases,heldNativeRows:held,
   originalResponses:reader.responses,lifecycleCleanupAllowed:false},enumerable:true,configurable:true})}catch{}
  throw error
 }
}
