import {createHash}from'node:crypto'
import {setTimeout as delay}from'node:timers/promises'
import {parse}from'acorn'
import C from'./catalog.js'
import {validateHandoff}from'./script.js'
import {readNativeDocument,extractActiveDescription}from'../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel}from'../../scraper-support/native-sources/literalModel.js'
import {nativeCountryName,nativeLocationCountryName}from'../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure}from'../../scraper-support/utils/sourceAvailability.js'
import {attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'

const base='https://www.embitel.com/',source=C.source,home=C.companyCareerPage,api=C.jobsApiUrl,client=C.jobsScriptUrl
const boards=[['cariad-india-openings','cariad-india-jobs','cariadBody'],['digital-service-openings','digital-service-openings','dsBody'],['pes-service-openings','pes-service-openings','pesBody'],['data-ai-openings','data-ai-openings','dataAiBody'],['corporate-function-openings','corporate-function-openings','corporateBody']]
const businessUnits=new Map([['Cariad',0],['Digital Solutions',1],['Product Engineering Services',2],['Corporate Functions',4]])
const norm=x=>String(x??'').replace(/\s+/g,' ').trim(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Embitel current publication: '+message),{abortRetries:true})}
const hash=x=>createHash('sha256').update(x).digest('hex')
function reader(options){
 const timeout=options.timeoutMs??180000,interval=options.requestIntervalMs??1000
 need(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000&&Number.isSafeInteger(interval)&&interval>=0&&(interval>=1000||options.fetchImpl),'invalid finite read budgets')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Embitel source deadline exceeded')),timeout)
 const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,transport=options.fetchImpl||globalThis.fetch,receipts=[],allowed=new Set([home,api,client,...boards.flatMap(([a,b])=>[base+a,base+b])])
 let count=0,total=0,last=0
 const read=async(url,post=false)=>{
  signal.throwIfAborted();need(allowed.has(url)&&++count<=30&&(!post||url===api),'request outside current declared protocol')
  const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});last=Date.now()
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)]);let listener
  try{return await Promise.race([(async()=>{
   const response=await transport(url,{method:post?'POST':'GET',...(post?{body:'action=get_wdhub_job',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'}}:{headers:{Accept:url===client?'application/javascript':'text/html'}}),credentials:'omit',redirect:'manual',signal:requestSignal})
   need(response?.url===url&&Number.isInteger(response.status)&&response.headers?.get&&response.body,'missing native HTTP metadata')
   need(response.status===200||url===base+boards[0][0]&&response.status===301,'native HTTP '+response.status)
   const chunks=[];let bytes=0
   for await(const chunk of response.body){bytes+=chunk.byteLength;total+=chunk.byteLength;need(bytes<=4000000&&total<=16000000,'aggregate native byte budget exceeded');chunks.push(chunk)}
   const body=Buffer.concat(chunks),text=body.toString('utf8');need(Buffer.from(text,'utf8').equals(body),'native response encoding unavailable')
   const headers=Object.fromEntries(response.headers),receipt={url,status:response.status,headers,bytes,sha256:hash(body),bodyBase64:body.toString('base64')};receipts.push(receipt)
   if(response.status===301){need(headers.location===base+boards[0][1],'unreviewed publisher redirect');return{...receipt,text}}
   need((post?/application\/json/i:url===client?/(?:java|ecma)script/i:/text\/html|application\/xhtml/i).test(headers['content-type']||''),'native response MIME unavailable')
   return{...receipt,text}
  })(),new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true});if(requestSignal.aborted)listener()})] )}
  finally{if(listener)requestSignal.removeEventListener('abort',listener)}
 }
 return{read,signal,receipts,check:()=>signal.throwIfAborted(),close:()=>{clearTimeout(timer);controller.abort()}}
}
function homeModel(html){
 const doc=readNativeDocument(html)
 for(const[path]of boards)need(doc.nodes(n=>n.tag==='a'&&n.attrs.href===base+path).length>0,'current official business-unit handoff unavailable')
 return{publisher:'Embitel Technologies',declaredBoards:boards.map(([path])=>base+path)}
}
function boardModel(html,index){
 const doc=readNativeDocument(html),[,canonical,bodyId]=boards[index]
 need(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===base+canonical).length===1,'own publisher canonical unavailable')
 need(doc.nodes(n=>n.attrs.id===bodyId).length===1,'native published business-unit container unavailable')
 need(doc.nodes(n=>n.tag==='script'&&n.attrs.src===client).length===1,'native public data client declaration unavailable')
 const config=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='wdhub-job-script-js-extra')
 need(config.length===1,'native public protocol declaration unavailable')
 const ast=parse(config[0].raw,{ecmaVersion:'latest'}),declaration=ast.body[0]?.declarations?.[0]
 need(ast.body.length===1&&declaration?.id?.name==='wdhubJobData'&&declaration.init?.type==='ObjectExpression','native public protocol binding changed')
 const model=readLiteralModel(config[0].raw.slice(declaration.init.start,declaration.init.end)).value
 need(model.ajaxUrl===api,'native own data endpoint changed')
 return{url:base+canonical,bodyId,protocol:model}
}
function protocol(js){
 need(Buffer.byteLength(js)<=200000,'native public client input budget exceeded')
 const ast=parse(js,{ecmaVersion:'latest'}),calls=[]
 const walk=value=>{if(!value||typeof value!=='object')return;if(value.type==='CallExpression'&&value.callee.type==='MemberExpression'&&!value.callee.computed&&value.callee.property.name==='ajax')calls.push(value);for(const item of Object.values(value))if(Array.isArray(item))item.forEach(walk);else if(item&&typeof item==='object')walk(item)};walk(ast)
 need(calls.length===1&&calls[0].arguments[0]?.type==='ObjectExpression','native public read declaration ambiguous')
 const properties=new Map(calls[0].arguments[0].properties.map(p=>[p.key.name??p.key.value,p.value]))
 const u=properties.get('url'),method=properties.get('type'),data=properties.get('data')
 need(u?.type==='MemberExpression'&&!u.computed&&u.object.name==='wdhubJobData'&&u.property.name==='ajaxUrl'&&method?.value==='POST'&&data?.type==='ObjectExpression','native public data read protocol changed')
 const action=data.properties.find(p=>(p.key.name??p.key.value)==='action')?.value
 need(action?.type==='Literal'&&action.value==='get_wdhub_job','native read-only action changed')
 return{endpoint:api,method:'POST',body:'action=get_wdhub_job',nativeClientExecuted:false}
}
function envelope(text){
 const value=readLiteralModel(text).value
 if(value?.success!==true)validateHandoff(value)
 need(value?.success===true&&Array.isArray(value.data)&&value.data.length>0&&value.data.length<=1500,'native published inventory unavailable')
 need(new Set(value.data.map(r=>r?.jobpostingID)).size===value.data.length,'duplicate native publication identity')
 return value
}
function nativeConstraints(row,observedAt){
 const now=new Date(observedAt);need(Number.isFinite(+now),'invalid availability observation date')
 for(const field of['isActive','active','canApply','isOpen','isPublished','published'])if(row[field]!=null)need(row[field]===true,'explicit native availability conflict: '+field)
 for(const field of['status','jobStatus','postingStatus','availability'])if(row[field]!=null)need(typeof row[field]==='string'&&/^(?:active|open|published|approved|posted|available|accepting applications)$/i.test(norm(row[field])),'explicit native availability conflict: '+field)
 for(const field of['country','countryCode','workCountry','workplaceCountry','locationCountry','addressCountry'])if(row[field]!=null)need(nativeCountryName(row[field])==='India','explicit native workplace country conflict')
 const locations=Array.isArray(row.jobLocation)?row.jobLocation:[row.jobLocation]
 for(const location of locations)if(location&&typeof location==='object'){
  for(const value of[location.addressCountry,location.address?.addressCountry])if(value!=null)need(nativeCountryName(value)==='India','explicit native structured workplace country conflict')
 }
 for(const field of['employer','legalEmployer','hiringOrganization','companyName','company'])if(row[field]!=null){
  const value=row[field],name=typeof value==='string'?value:value?.name
  need(['Embitel Technologies','Embitel Technologies (India) Private Limited','embIND Embitel Technologies (India) Private Limited'].includes(norm(name)),'explicit native employer conflict')
 }
 const expiry=[]
 for(const field of['validThrough','closingDate','applicationDeadline','dateExpires'])if(row[field]!=null&&row[field]!==''){
  const value=row[field],day=typeof value==='string'?value.slice(0,10):'',calendar=/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day
  need(calendar&&(value===day||/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))),'native expiry date unqualified: '+field)
  need(value===day?day>=now.toISOString().slice(0,10):Date.parse(value)>=+now,'native role explicitly expired: '+field)
  expiry.push({scope:'publication',field,value})
 }
 return expiry
}
export function embitelPublishedRole(row,observedAt=new Date().toISOString()){
 need(row&&/^JOB_POSTING-\d+-\d+$/.test(row.jobpostingID)&&norm(row.designation)&&norm(row.jobcode),'native publication identity unavailable')
 need(row.posted==='Y','native publication explicitly not posted')
 need(businessUnits.has(row.bu),'native employer/business-unit publication scope unqualified')
 const url=new URL(row.job_url),prefix=new URL(C.workdayBoardUrl)
 need(url.origin===prefix.origin&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname.startsWith(prefix.pathname+'/job/')&&/_JR\d+(?:-\d+)?$/.test(url.pathname),'native employer application route unavailable')
 need(['Bangalore','Pune'].includes(row.location),'exact native workplace country unresolved')
 const expiry=nativeConstraints(row,observedAt)
 need(row.jobdescription==null||typeof row.jobdescription==='string','native published criteria model unqualified')
 const description=extractActiveDescription(row.jobdescription??''),doc=readNativeDocument(row.jobdescription??''),blocks=doc.nodes(n=>['p','li','b','strong','h1','h2','h3','h4'].includes(n.tag)).map(doc.text)
 need(!findExplicitNativeClosure(blocks),'native role explicitly closed')
 for(const text of blocks){
  const c=/^(?:(?:work|job|workplace)\s+)?country\s*:\s*(.+)$/i.exec(text);if(c)need(nativeCountryName(c[1])==='India','full published criteria country conflict')
  const l=/^(?:(?:work|job)\s+)?(?:location|workplace)\s*[:\-]\s*(.+)$/i.exec(text);if(l){const c=nativeLocationCountryName(l[1]);need(!c||c==='India','full published criteria workplace country conflict')}
  const e=/^(?:employer|legal employer|hiring organization|company(?: name)?)\s*:\s*(.+)$/i.exec(text);if(e)need(['Embitel Technologies','Embitel Technologies (India) Private Limited','embIND Embitel Technologies (India) Private Limited'].includes(e[1]),'explicit published employer conflict')
 }
 return{source,title:norm(row.designation),company:'Embitel Technologies',nativeEmployer:null,nativeLegalEmployer:null,sourceNativePublisher:'Embitel Technologies',sourceLegalEmployerUnverified:true,
  jobId:row.jobpostingID,requisitionId:null,sourceNativeTechnicalJobTitle:row.jobcode,department:row.bu,sourceUrl:row.job_url,applyUrl:row.job_url,link:row.job_url,
  country:'India',city:null,location:row.location,sourceCountryScopeUnresolved:false,sourceCountryEvidence:{kind:'exact-whole-first-party-published-workplace',nativeLabel:row.location,country:'India',reference:row.location==='Bangalore'?'https://bengaluruurban.nic.in/en/history/':'https://pune.gov.in/en/'},
  sourceDescription:description,jobDescription:description,sourceNativeRecord:row,sourceRawDescriptionHtml:row.jobdescription,sourceCriteriaStatus:description?'present':'missing',sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'delegated-ATS-detail-unverified',
  sourceNativeAvailability:{firstPartyPosted:row.posted,delegatedATSCanApplyVerified:false,delegatedATSClosingVerified:false},sourceNativeApplication:{nativePublishedURL:row.job_url,activationVerified:false,submitted:false},
  postingDate:null,closingDate:expiry[0]?.value??null,sourceNativeDates:{timestamp:row.timestamp,timestampSemantics:'unspecified-native-timestamp-not-invented-publication-date',recognizedExpiryFields:expiry},
  experienceRequired:norm(row.experience)||null,employmentType:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  sourceCompanyScopeUnresolved:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
}
export async function runEmbitelPublished(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchJson,'metadata-free legacy callbacks cannot qualify current publications')
 const io=reader(options),jobs=[],held=[]
 const boardsRead=async()=>{const models=[];for(let i=0;i<boards.length;i++){let page=await io.read(base+boards[i][0]);if(page.status===301)page=await io.read(page.headers.location);models.push(boardModel(page.text,i))}return models}
 try{
  const openingHome=homeModel((await io.read(home)).text),publisherBoards=await boardsRead(),openingProtocol=protocol((await io.read(client)).text),opening=envelope((await io.read(api,true)).text)
  const applications=new Map();for(const r of opening.data)applications.set(r.job_url,(applications.get(r.job_url)||0)+1)
  for(const row of opening.data){
   try{need(applications.get(row.job_url)===1,'duplicate native application identity has multiple original postings');jobs.push(embitelPublishedRole(row,(options.now||(()=>new Date().toISOString()))()))}
   catch(error){held.push({id:row.jobpostingID,reason:error.message,originalRecord:row})}
  }
  const closing=envelope((await io.read(api,true)).text);need(same(opening,closing),'native closing whole published model differs')
  need(same(openingProtocol,protocol((await io.read(client)).text))&&same(publisherBoards,await boardsRead())&&same(openingHome,homeModel((await io.read(home)).text)),'native closing publisher/protocol differs')
  const observedAt=(options.now||(()=>new Date().toISOString()))();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
  for(const job of jobs){nativeConstraints(job.sourceNativeRecord,observedAt);job.scrapedAt=observedAt;job.sourceClosingQualified=true}
  const audit={source,openingNativeRecords:opening.data,closingNativeRecords:closing.data,publisherBoards,openingProtocol,held,originalResponses:io.receipts,openingClosingMatch:true,
   sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null,lifecycleCleanupAllowed:false,delegatedATSInventoryUnverified:true,delegatedATSActivationVerified:false,applicationsSubmitted:false}
  const result=Number.isSafeInteger(options.maxJobs)&&options.maxJobs>=0?jobs.slice(0,options.maxJobs):jobs
  attachSourceObservationEvidence(result,{source,recordKind:'vacancy-rows',observedRecordCount:opening.data.length,observedVacancyCount:opening.data.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:audit,configurable:true});await options.onAudit?.(structuredClone(audit));io.check()
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:home,firstParty:true,pagesFetched:io.receipts.length,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'stable-own-published-partial-criteria-and-exact-native-geography;delegated-ATS-employer-activation-inventory-and-duplicate-application-identities-held'})
 }finally{io.close()}
}
