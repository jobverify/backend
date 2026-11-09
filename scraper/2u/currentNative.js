import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {nativeHTMLText} from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {isRecruitmentIntakeTitle} from '../../scraper-support/utils/recruitmentObservationAccounting.js'

const ORIGIN='https://2u.com',CAREERS=ORIGIN+'/careers/',JOBS=CAREERS+'jobs/'
const CLIENT_SHA='02dc11daeb8c981a8486c5e945a1a954b336a9f091523af10fe2e1dbbf06b737'
const APP_SHA='90f207c5fa423c5f37d30dc3dfea5dfa0549405cd5ed383c668960213869ef65'
// These three GETs and the role path expression are reviewed in the exact
// current client/app programs. Hash changes require a fresh contract review.
const QUERIES=['1843004117','33579118','3494932948']
const sha=value=>createHash('sha256').update(value).digest('hex')
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const characters=value=>String(value).replace(/\s/gu,'')
const error=(message,code='TWO_U_CURRENT_CONTRACT_CHANGED')=>Object.assign(new Error('2U: '+message),{code})
const requireValue=(ok,message,code)=>{if(!ok)throw error(message,code)}
const executable=node=>!Object.hasOwn(node.attrs,'nomodule')
 &&['','text/javascript','application/javascript','module'].includes((node.attrs.type||'').trim().toLowerCase())
const integer=value=>Number.isSafeInteger(value)&&value>0
const clock=value=>value===undefined||value===null?null:typeof value==='string'&&Number.isFinite(Date.parse(value))?value:undefined
const ignore=start=>{try{Promise.resolve(start()).catch(()=>{})}catch{}}
const discardBody=body=>{
 if(typeof body?.cancel==='function'){ignore(()=>body.cancel());return}
 if(typeof body?.getReader==='function'){
  let reader;try{reader=body.getReader();ignore(()=>reader.cancel())}catch{}finally{if(reader)ignore(()=>reader.releaseLock())}
 }
}

// Loading of scripts/base elements is independent of CSS visibility. Template
// contents and raw/fallback namespaces cannot establish current declarations.
function browserNodes(doc,predicate){
 const found=[],root=doc.nodes(n=>n.tag==='root')[0]
 const visit=node=>{
  if(node.nativeTagUnqualified||['template','noscript','object','iframe','textarea','style','xmp','plaintext','svg'].includes(node.tag))return
  if(predicate(node))found.push(node)
  for(const child of node.children||[])if(typeof child!=='string')visit(child)
 }
 if(root)visit(root)
 return found
}
function documentBase(doc,url){
 const elements=browserNodes(doc,n=>n.tag==='base'&&Object.hasOwn(n.attrs,'href'))
 if(!elements.length)return url
 let base;try{base=new URL(elements[0].attrs.href,url)}catch{throw error('Current document base declaration changed')}
 requireValue(base.origin===ORIGIN&&!base.username&&!base.password,'Current document base changed authority')
 return base.href
}

async function abortable(start,signal){
 signal.throwIfAborted()
 let listener
 const cancelled=new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true})})
 try{return await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return start()}),cancelled])}
 catch(cause){signal.throwIfAborted();throw cause}
 finally{signal.removeEventListener('abort',listener)}
}

function optionsFor(defaults,passed){
 // Undefined runtime fields retain the factory's explicit limits; null removes
 // only optional caps. Hard request, byte and deadline bounds still validate.
 const defined=value=>Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined))
 const supplied={...defined(defaults),...defined(passed)}
 supplied.signal?.throwIfAborted()
 const options={maxRequests:32,maxDetails:64,responseBytes:4*1024*1024,aggregateBytes:16*1024*1024,
  requestTimeoutMs:15000,auditTimeoutMs:15000,sourceTimeoutMs:360000,maxJobs:null,maxPages:null,...supplied}
 for(const [name,maximum] of [['maxRequests',64],['maxDetails',128],['responseBytes',8*1024*1024],['aggregateBytes',32*1024*1024],
  ['requestTimeoutMs',30000],['auditTimeoutMs',15000],['sourceTimeoutMs',900000]])
  requireValue(integer(options[name])&&options[name]<=maximum,'Invalid '+name,'TWO_U_INVALID_OPTIONS')
 requireValue(options.maxJobs===null||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0,'Invalid maxJobs','TWO_U_INVALID_OPTIONS')
 requireValue(options.maxPages===null||Number.isSafeInteger(options.maxPages)&&options.maxPages>=0,'Invalid maxPages','TWO_U_INVALID_OPTIONS')
 for(const key of ['now','onAudit','fetchPage','fetchImpl'])
  requireValue(options[key]===undefined||typeof options[key]==='function','Invalid '+key,'TWO_U_INVALID_OPTIONS')
 requireValue(!(options.fetchText||options.fetchJson)||options.fetchPage||options.fetchImpl,'Original HTTP responses and bytes are required','TWO_U_ORIGINAL_HTTP_REQUIRED')
 const skipAcquisition=options.maxJobs===0||options.maxPages===0
 if(skipAcquisition)return{options,observedAt:null,skipAcquisition}
 const observedAt=(options.now||(()=>new Date().toISOString()))()
 requireValue(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid observation clock','TWO_U_INVALID_OPTIONS')
 return{options,observedAt,skipAcquisition}
}

function scriptURL(html,pattern){
 const doc=readNativeDocument(html),base=documentBase(doc,JOBS),found=[]
 for(const node of browserNodes(doc,node=>node.tag==='script'&&node.attrs.src&&executable(node))){
  let url;try{url=new URL(node.attrs.src,base)}catch{continue}
  if(url.origin===ORIGIN&&!url.username&&!url.password&&!url.search&&!url.hash&&pattern.test(url.pathname))found.push(url.href)
 }
 requireValue(found.length===1,'Current active program declaration changed')
 return found[0]
}

function cmsIndex(model,label){
 const pages=model?.data?.cms?.pages
 requireValue(Array.isArray(pages),'Current native '+label+' model changed')
 const index=new Map()
 for(const page of pages){
  requireValue(typeof page?.title==='string'&&typeof page.id==='string'&&Array.isArray(page.ghid),'Malformed native '+label+' record')
  for(const raw of page.ghid){
   requireValue(typeof raw==='string'&&/^[1-9]\d*$/.test(raw)&&Number.isSafeInteger(Number(raw))&&!index.has(Number(raw)),'Duplicate or malformed native '+label+' identity')
   index.set(Number(raw),page)
  }
 }
 return index
}

const countryLabel=value=>{
 const text=norm(value),matches=[]
 for(const [pattern,country] of [[/\bIndia\b/i,'India'],[/\b(?:United States|USA|US)\b/i,'United States'],
  [/\b(?:United Kingdom|UK)\b/i,'United Kingdom'],[/\bSouth Africa\b/i,'South Africa']])if(pattern.test(text))matches.push(country)
 return matches.length===1?matches[0]:null
}
const abbreviation=new Map([['IN','India'],['US','United States'],['UK','United Kingdom'],['ZA','South Africa']])
function projectNative(row,teams,locations,modelPage){
 requireValue(integer(row?.alternative_id)&&typeof row.title==='string'&&norm(row.title)&&typeof row.content==='string'
  &&Array.isArray(row.departments)&&row.departments.length>0&&Array.isArray(row.offices),'Malformed native role identity or content')
 const department=row.departments[0]
 requireValue(integer(department.alternative_id),'Malformed native role department identity')
 const team=teams.get(department.alternative_id)||teams.get(department.parent_id)||null
 const assigned=row.offices.map(office=>{
  requireValue(integer(office?.alternative_id)&&typeof office.name==='string','Malformed native office identity')
  const cms=locations.get(office.alternative_id)||null,nativeCountry=countryLabel(office.name),cmsCountry=cms?abbreviation.get(cms.abbreviation)||null:null
  const cmsTitleCountry=cms?countryLabel(cms.title):null
  const countryConflict=Boolean(nativeCountry&&cmsCountry&&nativeCountry!==cmsCountry
   ||cmsTitleCountry&&cmsCountry&&cmsTitleCountry!==cmsCountry||nativeCountry&&cmsTitleCountry&&nativeCountry!==cmsTitleCountry)
  return{nativeOffice:structuredClone(office),nativeCMSOffice:cms?structuredClone(cms):null,
   country:nativeCountry&&nativeCountry===cmsCountry&&!countryConflict?nativeCountry:null,
   nativeOfficeCountry:nativeCountry,cmsAbbreviationCountry:cmsCountry,cmsTitleCountry,countryConflict}
 })
 const countries=[...new Set(assigned.map(row=>row.country).filter(Boolean))]
 const sourceCountryComplete=assigned.length>0&&assigned.every(row=>row.country&&!row.countryConflict)
 const jobDescription=nativeHTMLText(row.content)
 const employerBound=/\bAt 2U\b/.test(jobDescription)&&/\b2U is an equal opportunity employer\b/.test(jobDescription)
 const nativeCriteriaComplete=employerBound&&jobDescription.length>=400
  &&/Responsibilities Include/i.test(jobDescription)&&/Things That Should Be In Your Background/i.test(jobDescription)
 const updatedAt=clock(row.updated_at)
 requireValue(updatedAt!==undefined,'Malformed native update clock')
 return{id:String(row.alternative_id),url:JOBS+row.alternative_id+'/',title:norm(row.title),vacancy:!isRecruitmentIntakeTitle(row.title),
  country:sourceCountryComplete?(countries.includes('India')?'India':countries.length===1?countries[0]:null):null,
  sourceNativeCountries:countries,sourceCountryComplete,sourceNativeCountryEvidence:assigned,team:team?.title??null,
  nativeEmployerBound:employerBound,nativeCriteriaComplete,visibleCriteriaMatch:false,visibleCountryMatch:false,
  jobDescription,nativeContent:row.content,nativeSourceRecord:structuredClone(row),
  postingDate:null,nativePostingDate:null,nativeUpdatedAt:updatedAt,sourceDetailComplete:false,
  sourceObservedAt:modelPage.completedAt,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
  applicationVisited:false,legalEmployer:null}
}

export const createCurrentScraper=(defaults={})=>({async run(passed={}){
 const {options,observedAt,skipAcquisition}=optionsFor(defaults,passed)
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const sourceDeadline=performance.now()+options.sourceTimeoutMs
 const sourceTimer=setTimeout(()=>controller.abort(error('Public source deadline exceeded','TWO_U_PUBLIC_SOURCE_TIMEOUT')),options.sourceTimeoutMs)
 const audit={source:'2u',observedAt,originalPages:[],observations:[],opening:null,closing:null,closingMatches:false,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,heldHosts:[],
  publicationScope:'Current corporate Gatsby static-query publication; live ATS and whole-company scope are unverified.',failures:[],productionWrites:false}
 let bytesRead=0,requests=0,failed=false,failure,jobs=[]
 const checkSource=()=>{
  signal.throwIfAborted()
  if(performance.now()>=sourceDeadline)controller.abort(error('Public source deadline exceeded','TWO_U_PUBLIC_SOURCE_TIMEOUT'))
  signal.throwIfAborted()
 }
 const bounded=async(start,label,ms)=>{
  checkSource()
  const deadline=performance.now()+ms,expired=()=>error('Public '+label.toLowerCase()+' deadline exceeded','TWO_U_PUBLIC_'+label+'_TIMEOUT')
  const check=()=>{checkSource();if(performance.now()>=deadline)controller.abort(expired());signal.throwIfAborted()}
  const timer=setTimeout(()=>controller.abort(expired()),ms)
  try{const value=await abortable(()=>{check();return start()},signal);check();return value}
  catch(cause){check();throw cause}
  finally{clearTimeout(timer)}
 }
 const read=async(url,kind,phase)=>bounded(async()=>{
  const target=new URL(url)
  requireValue(target.origin===ORIGIN&&!target.username&&!target.password&&!target.hash,'Unreviewed public URL refused')
  requireValue(!audit.heldHosts.includes(target.hostname),'Public host access denied; no retries')
  requireValue(requests<options.maxRequests,'Public request budget exhausted','TWO_U_PUBLIC_REQUEST_BUDGET')
  requireValue(options.maxPages===null||requests<options.maxPages,'Public page budget exhausted','TWO_U_PUBLIC_PAGE_BUDGET')
  requireValue(bytesRead<options.aggregateBytes,'Public aggregate byte limit exceeded','TWO_U_PUBLIC_BYTE_LIMIT')
  requests++
  const init={method:'GET',redirect:'manual',credentials:'omit',signal,
   headers:{Accept:kind==='json'?'application/json':kind==='javascript'?'application/javascript,text/javascript':'text/html',
    'User-Agent':'Mozilla/5.0 (compatible; Jobverify public careers inventory)'}}
  let raw
  if(options.fetchPage)raw=await abortable(()=>options.fetchPage(url,init),signal)
  else{
   const requestedAt=new Date().toISOString(),response=await abortable(()=>Promise.resolve((options.fetchImpl||globalThis.fetch)(url,init)).then(response=>{
    if(signal.aborted)discardBody(response?.body)
    return response
   }),signal)
   try{
    requireValue(response?.url===url&&!response.redirected,'Original response identity changed')
    const headers=Object.fromEntries(response.headers)
    if(response.status!==200){
     // Retain original denied/redirect/error headers before a body can hang.
     // A missing body is explicitly unavailable; no empty body/hash is invented.
     discardBody(response.body)
     raw={url:response.url,status:response.status,headers,bodyBase64:null,requestedAt,completedAt:null,
      headersObservedAt:new Date().toISOString(),bodyUnavailableReason:'Original non-success headers retained; entity not read and body completion unavailable'}
    }else{
     const length=response.headers.get('content-length')
     if(length!==null)requireValue(/^\d+$/.test(length)&&Number(length)<=options.responseBytes,'Public response byte limit exceeded','TWO_U_PUBLIC_BYTE_LIMIT')
     const reader=response.body?.getReader(),chunks=[];let count=0
     if(reader){
      try{for(;;){signal.throwIfAborted();const {done,value}=await abortable(()=>reader.read(),signal);if(done)break
       requireValue(value instanceof Uint8Array,'Original response byte chunk unavailable')
       count+=value.byteLength
       requireValue(count<=options.responseBytes&&bytesRead+count<=options.aggregateBytes,'Public response byte limit exceeded','TWO_U_PUBLIC_BYTE_LIMIT')
       chunks.push(Buffer.from(value))
      }}catch(cause){ignore(()=>reader.cancel());throw cause}
      finally{ignore(()=>reader.releaseLock())}
     }
     raw={url:response.url,status:response.status,headers,bodyBase64:reader?Buffer.concat(chunks).toString('base64'):null,
      requestedAt,completedAt:new Date().toISOString()}
    }
   }catch(cause){discardBody(response?.body);throw cause}
  }
  signal.throwIfAborted()
  requireValue(raw&&raw.url===url&&Number.isInteger(raw.status)&&raw.status>=100&&raw.status<=599,'Original response identity changed')
  const headers=Object.fromEntries(Object.entries(raw.headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]))
  const requestedAt=clock(raw.requestedAt),completedAt=clock(raw.completedAt)
  requireValue(requestedAt!==undefined&&completedAt!==undefined&&(!requestedAt||!completedAt||Date.parse(requestedAt)<=Date.parse(completedAt)),'Original response clocks changed')
  const page={requestedURL:url,finalURL:raw.url,status:raw.status,headers,phase,kind,method:'GET',redirect:'manual',credentials:'omit',
   requestedAt,completedAt,headersObservedAt:clock(raw.headersObservedAt)??null,bodyUnavailableReason:raw.bodyUnavailableReason??null,
   bodyBase64:null,bodySHA256:null,bytes:null,originalText:null}
  audit.originalPages.push(page)
  if(raw.bodyBase64!==null&&raw.bodyBase64!==undefined){
   requireValue(typeof raw.bodyBase64==='string'&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw.bodyBase64),'Original response bytes are invalid')
   const body=Buffer.from(raw.bodyBase64,'base64')
   requireValue(body.length<=options.responseBytes&&bytesRead+body.length<=options.aggregateBytes,'Public response byte limit exceeded','TWO_U_PUBLIC_BYTE_LIMIT')
   bytesRead+=body.length
   Object.assign(page,{bodyBase64:raw.bodyBase64,bodySHA256:sha(body),bytes:body.length,originalText:new TextDecoder('utf8',{fatal:true}).decode(body)})
  }
  const challenge=/<title\b[^>]*>\s*(?:access denied|just a moment|verify you are human|security check)/i.test((page.originalText||'').slice(0,24000))
  if([401,403,429,451].includes(raw.status)||challenge){
   audit.heldHosts.push(target.hostname)
   throw Object.assign(error('Original public HTTP '+raw.status+' access denied; no retries','TWO_U_PUBLIC_ACCESS_DENIED'),
    {status:raw.status,softFailure:true,upstreamOutage:true,abortRetries:true,failureKind:'blocked_or_access_denied'})
  }
  if(raw.status!==200)throw Object.assign(error('Original public HTTP '+raw.status,'TWO_U_PUBLIC_HTTP_STATUS'),{status:raw.status,abortRetries:true})
  requireValue(page.bodyBase64!==null,'Original decoded response bytes are required','TWO_U_ORIGINAL_HTTP_REQUIRED')
  const type=(headers['content-type']||raw.contentType||'').split(';',1)[0].trim().toLowerCase()
  requireValue(kind==='json'?/^(?:application|text)\/(?:[\w.+-]+\+)?json$/.test(type):kind==='javascript'?/^(?:application|text)\/(?:java|ecma)script$/.test(type):['text/html','application/xhtml+xml'].includes(type),'Unexpected original public response type')
  return page
 },'READ',options.requestTimeoutMs)
 const snapshot=async phase=>{
  const primary=await read(CAREERS,'html',phase)
  requireValue(activeHead(primary.originalText).titles.some(title=>/Careers\s*\|\s*2U/i.test(title)),'Current corporate careers identity changed')
  const doc=readNativeDocument(primary.originalText),base=documentBase(doc,CAREERS)
  requireValue(doc.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,base).href===JOBS}catch{return false}}),'Current public jobs declaration changed')
  const listing=await read(JOBS,'html',phase)
  requireValue(activeHead(listing.originalText).titles.some(title=>/EdTech Jobs.*\|\s*2U/i.test(title)),'Current corporate jobs identity changed')
  const clientURL=scriptURL(listing.originalText,/^\/careers-teams-locations-[a-f0-9]+\.js$/),appURL=scriptURL(listing.originalText,/^\/app-[a-f0-9]+\.js$/)
  const client=await read(clientURL,'javascript',phase),app=await read(appURL,'javascript',phase)
  requireValue(client.bodySHA256===CLIENT_SHA&&app.bodySHA256===APP_SHA,'Current public recruiting program contract changed')
  const models=[]
  for(const id of QUERIES){const page=await read(ORIGIN+'/page-data/sq/d/'+id+'.json','json',phase);models.push({page,model:readLiteralModel(page.originalText).value})}
  const rows=models[0].model?.data?.greenhouseJobs?.jobs
  requireValue(Array.isArray(rows)&&rows.length<=128,'Current native jobs model changed or exceeds the reviewed bound')
  const ids=new Set()
  for(const row of rows){requireValue(integer(row?.alternative_id)&&!ids.has(row.alternative_id),'Duplicate or malformed native role identity');ids.add(row.alternative_id)}
  const teams=cmsIndex(models[1].model,'team'),locations=cmsIndex(models[2].model,'office')
  const observations=rows.map(row=>projectNative(row,teams,locations,models[0].page))
  if(phase==='opening')audit.observations=observations
  const result={clientURL,appURL,clientSHA256:client.bodySHA256,appSHA256:app.bodySHA256,
   nativeModels:models.map(row=>row.model),observedStaticQueryRowCount:rows.length,observations}
  audit[phase]=result
  requireValue(observations.length<=options.maxDetails,'Native role detail budget is insufficient')
  for(const row of observations){
   const detail=await read(row.url,'html',phase),view=readNativeDocument(detail.originalText)
   const headings=view.nodes(n=>n.tag==='h1').map(n=>view.text(n))
   const criteria=view.nodes(n=>(n.attrs.class||'').split(/\s+/).includes('jobDetailsContent')).map(n=>view.text(n))
   row.visibleCriteriaMatch=headings.length===1&&norm(headings[0])===row.title&&criteria.length===1
    &&characters(criteria[0])===characters(row.jobDescription)
   const callouts=view.nodes(n=>(n.attrs.class||'').split(/\s+/).includes('jobDetailsCalloutBoxDescription')).map(n=>view.text(n))
   const prefix='Note: By applying to this position your application is automatically submitted to the following locations:'
   const expectedLabels=row.sourceNativeCountryEvidence.map(e=>e.nativeCMSOffice?norm(e.nativeCMSOffice.title)+', '+norm(e.nativeCMSOffice.abbreviation):null)
   row.visibleCountryMatch=callouts.length===1&&callouts[0].startsWith(prefix)&&expectedLabels.length>0&&expectedLabels.every(Boolean)
    &&norm(callouts[0].slice(prefix.length))===expectedLabels.join('; ')
   row.visibleCountryEvidence={originalCallouts:callouts,expectedLocationLabels:expectedLabels,
    comparison:'complete-reviewed-corporate-location-callout-equals-all-native-CMS-location-labels',matches:row.visibleCountryMatch}
   row.sourceCountryComplete=row.sourceCountryComplete&&row.visibleCountryMatch
   if(!row.sourceCountryComplete)row.country=null
   row.criteriaComparison='complete-visible-native-text-equal-ignoring-whitespace'
   row.sourceDetailComplete=row.visibleCriteriaMatch&&row.nativeCriteriaComplete&&row.sourceCountryComplete
   row.originalDetailCompletedAt=detail.completedAt
   requireValue(row.visibleCriteriaMatch,'Complete visible role criteria or title changed')
  }
  return result
 }
 try{
  try{if(!skipAcquisition){
   const opening=await snapshot('opening'),closing=await snapshot('closing')
   const comparison=phase=>[phase.clientURL,phase.appURL,phase.nativeModels,phase.observations.map(row=>[
    row.id,row.country,row.sourceCountryComplete,row.visibleCountryMatch,row.visibleCountryEvidence.originalCallouts])]
   audit.closingComparison='complete-native-models-program-identities-and-visible-role-location-context'
   audit.closingMatches=JSON.stringify(comparison(opening))===JSON.stringify(comparison(closing))
   requireValue(audit.closingMatches,'Closing native publication changed','TWO_U_CLOSING_CHANGED')
   jobs=audit.observations.filter(row=>row.vacancy&&row.sourceDetailComplete&&row.nativeEmployerBound&&row.sourceCountryComplete&&row.sourceNativeCountries.includes('India')).map(row=>({
    ...row,source:'2u',companyName:'2U',company:'2U',jobId:row.id,jobUrl:row.url,applyUrl:null,
    location:row.sourceNativeCountryEvidence.map(e=>e.nativeOffice.name).join('; '),scrapedAt:observedAt,
    sourceDetailComplete:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
   }))
   if(options.maxJobs!==null)jobs=jobs.slice(0,options.maxJobs)
  }}catch(cause){failed=true;failure=cause;audit.failures.push({code:cause?.code??null,message:typeof cause?.message==='string'?cause.message:'Opaque caller/read failure'})}
  signal.throwIfAborted()
  audit.requestCount=requests;audit.aggregateBytes=bytesRead
  const evidence={status:'coverage-gap',surface:CAREERS,firstParty:audit.originalPages.length>0,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:audit.originalPages.length,verifiedAt:observedAt,reason:skipAcquisition?'caller-zero-cap-no-inventory-proof':'current-corporate-static-publication-live-ATS-and-company-scope-unverified'}
  audit.inventoryEvidence=evidence
  attachInventoryEvidence(jobs,evidence)
  const vacancies=audit.observations.filter(row=>row.vacancy).length
  attachSourceObservationEvidence(jobs,{source:'2u',recordKind:vacancies===audit.observations.length?'vacancy-rows':vacancies?'mixed':'hiring-signals',observedRecordCount:audit.observations.length,
   observedVacancyCount:vacancies,sourceScopeComplete:false})
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit){
   try{await bounded(()=>options.onAudit(audit),'AUDIT',options.auditTimeoutMs)}
   catch(cause){
    options.signal?.throwIfAborted()
    if(!failed)throw cause
    audit.auditSinkFailure={code:cause?.code??null,message:typeof cause?.message==='string'?cause.message:'Opaque audit failure'}
   }
  }
  options.signal?.throwIfAborted()
  if(!failed)checkSource()
  if(failed){
   // Optional data descriptors must never invoke a setter or replace an
   // immutable/nonconfigurable original reason.
   try{if(failure&&typeof failure==='object'&&Object.isExtensible(failure)){
    try{Object.defineProperty(failure,'sourceAudit',{value:audit,configurable:true})}catch{}
    if(Object.getOwnPropertyDescriptor(failure,'failureKind')?.value==='blocked_or_access_denied'){
     Object.defineProperty(failure,'recruitmentObservations',{configurable:true,value:{source:'2u',observedAt,
      sourceScopeComplete:false,lifecycleCleanupAllowed:false,receipts:audit.originalPages.map(page=>({
       requestedURL:page.requestedURL,finalURL:page.finalURL,status:page.status,bodyBytes:page.bytes,bodySHA256:page.bodySHA256}))}})
    }
   }}catch{}
   throw failure
  }
  return jobs
 }finally{clearTimeout(sourceTimer)}
}})
