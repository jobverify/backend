import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

export const CAREERS_URL='https://www.seweurodriveindia.com/career/your_career/your_career.html'
export const SOURCE='seweurodriveindiapvtltd'
export const COMPANY='SEW-Eurodrive India Pvt Ltd'
const APPLICATION='https://www.seweurodriveindia.com/meta_seiten/web_online_contact_form_career.html'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const clean=value=>decodeNativeEntities(String(value??'')).replace(/\s+/g,' ').trim()
const held=message=>Object.assign(Error('SEW current listing: '+message),{code:'SEW_NATIVE_CONTRACT_HELD',softFailure:true,upstreamOutage:false,failureKind:'coverage_gap',abortRetries:true})
const need=(value,message)=>{if(!value)throw held(message)}
function contains(parent,target){return parent===target||parent.children.some(child=>typeof child!=='string'&&contains(child,target))}
function document(html){
 need(typeof html==='string'&&Buffer.byteLength(html)<=4e6,'missing or oversized HTML')
 const parsed=readNativeDocument(html),root=parsed.nodes(n=>n.tag==='root')[0],nodes=[]
 const allowed=node=>!node.inert&&!['blockquote','q','pre','code','template','noscript','script','style','object','iframe'].includes(node.tag)
 const visit=node=>{if(!allowed(node))return;nodes.push(node);for(const child of node.children)if(typeof child!=='string')visit(child)}
 visit(root)
 const text=node=>!allowed(node)?'':clean(node.children.map(child=>typeof child==='string'?child:text(child)).join(' '))
 return {nodes:(predicate,subtree)=>nodes.filter(node=>(!subtree||contains(subtree,node))&&predicate(node)),text,root}
}
const absolute=value=>{try{const url=new URL(value,CAREERS_URL);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash?url.href:null}catch{return null}}
function official(doc){
 const content=doc.text(doc.root)
 return doc.nodes(n=>/^h[1-3]$/.test(n.tag)&&doc.text(n)==='Your career at SEW-EURODRIVE').length===1
  &&/Job opportunities/i.test(content)&&/current job offers/i.test(content)&&/Take a look at our current job opportunities\./i.test(content)
}
export const hasOfficialCareersSignal=html=>official(document(html))
export function extractApplicationFormUrl(html){
 const doc=document(html),links=doc.nodes(n=>n.tag==='a'&&/^application form$/i.test(doc.text(n))).map(n=>absolute(n.attrs.href))
 return links.length===1&&links[0]===APPLICATION?APPLICATION:null
}
const display=new Intl.DisplayNames(['en'],{type:'region'}),written=[]
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name!==code&&!['ZZ','EU','EZ','UN','QO','XA','XB'].includes(code))written.push(name)}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const writtenPattern=new RegExp('(?:^|[^\\p{L}])('+written.sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?=$|[^\\p{L}])','giu')
const writtenNames=new Set(written.map(name=>name.toLowerCase()))
export function explicitWorksiteCountry(raw){
 if(/\b(?:not|outside|excluding|except)\s+India\b/i.test(raw))return null
 const countries=new Set(),groups=raw.split(/[/;|]/)
 // A terminal written country cannot override an earlier explicit country label.
 // Codes are meaningful only in this typed context; bare CA remains unresolved.
 for(const match of raw.matchAll(/\bcountry(?:\s+code)?\s*:\s*([^,()/;|]*)/gi)){
  const value=clean(match[1].split(/\s+[-–—]\s+/)[0]),country=nativeCountryName(value)
  if(!country)return null
  countries.add(country)
 }
 for(const group of groups){
  const parts=group.split(/[(),]|\s+[-–—]\s+/).map(clean).filter(Boolean),last=parts.at(-1)||'',typed=last.match(/^country(?:\s+code)?\s*:\s*(.+)$/i)
  const country=typed?nativeCountryName(typed[1]):writtenNames.has(last.toLowerCase())?nativeCountryName(last):null
  if(!country)return null
  countries.add(country)
 }
 for(const match of raw.matchAll(writtenPattern))countries.add(nativeCountryName(match[1]))
 return countries.size===1?[...countries][0]:null
}
const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
export function extractOpenings(html){
 const doc=document(html);need(official(doc),'verified official careers surface active publisher/declarations changed')
 const application=extractApplicationFormUrl(html);need(application,'current application handoff changed')
 const tables=doc.nodes(n=>n.tag==='table').filter(table=>{
  const first=doc.nodes(n=>n.tag==='tr',table)[0],cells=first?.children.filter(n=>typeof n!=='string'&&['th','td'].includes(n.tag)&&!n.inert)||[]
  return cells.length===5&&/^Sr\.?\s*No\.?$/i.test(doc.text(cells[0]))&&['Job Position','Location','Vertical','Job Description'].every((label,i)=>doc.text(cells[i+1])===label)
 })
 need(tables.length===1,'unambiguous active openings table changed')
 const rows=doc.nodes(n=>n.tag==='tr',tables[0]).slice(1);need(rows.length>0&&rows.length<=200,'current vacancy row count unverified')
 const seen=new Set(),jobs=[]
 for(const row of rows){
  const cells=row.children.filter(n=>typeof n!=='string'&&['td','th'].includes(n.tag)&&!n.inert)
  need(cells.length===5,'active row cells changed')
  const [serialNumber,title,rawLocation,department]=cells.slice(0,4).map(doc.text),links=doc.nodes(n=>n.tag==='a',cells[4])
  need(title&&rawLocation&&department&&links.length===1,'current vacancy identity incomplete')
  const declaredPDF=absolute(links[0].attrs.href),trustedPDF=declaredPDF&&['https://media.sew-eurodrive.com','https://www.seweurodriveindia.com'].includes(new URL(declaredPDF).origin)&&/\.pdf$/i.test(new URL(declaredPDF).pathname)?declaredPDF:null
  const jobId=SOURCE+'-'+slug([title,department,rawLocation].join(' '));need(!seen.has(jobId),'ambiguous derived internal identity');seen.add(jobId)
  const country=explicitWorksiteCountry(rawLocation),listingSummary=clean(`Official ${COMPANY} opening for ${title} in ${department} at ${rawLocation}. Refer to the first-party job description PDF for role details and apply through the official SEW-EURODRIVE India application form.`)
  jobs.push({source:SOURCE,title,company:COMPANY,department,location:rawLocation,city:null,country,sourceCountryScopeUnresolved:country===null,
   jobId,requisitionId:null,nativeJobId:null,nativeRequisitionId:null,sourceInternalIdDerived:true,sourceInternalIdBasis:'source-title-department-raw-listing-location',nativeLegalEmployer:null,
   sourceListingURL:CAREERS_URL,sourceUrl:trustedPDF||CAREERS_URL,sourceDeclaredPDFURL:declaredPDF,sourceDeclaredPDFURLAllowed:!!trustedPDF,sourcePDFContractVerified:false,
   sourceNativeListingCells:{serialNumber,title,rawLocation,department,declaredPDFHref:links[0].attrs.href},sourceListingRawLocation:rawLocation,
   applyUrl:application,link:application,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,
   listingSummary,jobDescription:null,sourceDescription:null,description:null,sourceDetailComplete:false,sourceDetailFailureKind:trustedPDF?'native-pdf-contract-unverified':'unreviewed-pdf-delegation',
   sourceDetailFailure:{name:'UnsupportedNativePdfContract',message:'No genuine reviewed own PDF identity/employer/worksite/criteria contract is available.'},
   sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,skipPublicExperienceEnrichment:true,applicationVisited:false})
 }
 return jobs
}
const own=(value,key)=>{try{return Object.getOwnPropertyDescriptor(value,key)?.value}catch{return undefined}}
const domGetters=Object.fromEntries(['name','message'].map(key=>[key,Object.getOwnPropertyDescriptor(DOMException.prototype,key).get]))
const errorValue=(error,key)=>{const value=own(error,key);if(value!==undefined)return value;try{return domGetters[key]?.call(error)}catch{return undefined}}
const boundedFailure=(error,depth=0,seen=new Set())=>{
 seen.add(error)
 const message=errorValue(error,'message'),code=own(error,'code'),status=own(error,'status'),name=errorValue(error,'name')
 const cause=own(error,'cause')
 return {name:typeof name==='string'?name.slice(0,64):'Error',message:typeof message==='string'?message.replace(/[\u0000-\u001f]/g,' ').slice(0,240):'Native detail diagnostic failed',...(typeof code==='string'?{code:code.slice(0,64)}:{}),...(Number.isInteger(status)?{status}:{}),...(cause&&typeof cause==='object'&&depth<2&&!seen.has(cause)?{cause:boundedFailure(cause,depth+1,seen)}:{})}
}
export function createSeweurodriveIndiaScraper({maxJobs=null}={}){
 need(maxJobs===null||Number.isSafeInteger(maxJobs)&&maxJobs>0&&maxJobs<=200,'invalid row limit')
 return {async run(options={}){
  const {signal:caller,fetchImpl=fetch,fetchText,fetchDocumentText}=options,sourceMs=options.sourceTimeoutMs??90000,requestMs=options.requestTimeoutMs??15000
  need(Number.isSafeInteger(sourceMs)&&sourceMs>0&&sourceMs<=180000&&Number.isSafeInteger(requestMs)&&requestMs>0&&requestMs<=15000,'invalid public read deadline')
  const started=performance.now(),controller=new AbortController(),sourceReason=new DOMException('SEW source deadline exceeded','TimeoutError'),timer=setTimeout(()=>controller.abort(sourceReason),sourceMs)
  const signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,receipts=[],retained=[],failures=[]
  let observed=null,firstParty=false
  const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=sourceMs)controller.abort(sourceReason);signal.throwIfAborted()}
  const diagnosticRead=async operation=>{
   const local=new AbortController(),expires=performance.now()+requestMs,reason=new DOMException('SEW request deadline exceeded','TimeoutError'),clock=setTimeout(()=>local.abort(reason),requestMs),combined=AbortSignal.any([signal,local.signal])
   const current=()=>{check();if(performance.now()>=expires)local.abort(reason);combined.throwIfAborted()}
   let detach
   try{return await new Promise((resolve,reject)=>{
    let done=false
    const fail=error=>{if(!done){done=true;detach();reject(error)}}
    const abort=()=>fail(combined.reason);detach=()=>combined.removeEventListener('abort',abort);combined.addEventListener('abort',abort,{once:true})
    try{current()}catch(error){fail(error);return}
    Promise.resolve().then(()=>{current();return operation(combined)}).then(value=>{if(done)return;try{current()}catch(error){fail(error);return}done=true;detach();resolve(value)},error=>{if(done)return;try{current()}catch(expired){error=expired}fail(error)})
   })}finally{clearTimeout(clock);detach?.()}
  }
  try{
   check();let html
   if(fetchText){html=await diagnosticRead(s=>fetchText(CAREERS_URL,{signal:s}));need(typeof html==='string'&&Buffer.byteLength(html)<=4e6,'unverified callback HTML is absent or oversized')}
   else{
    const requestedAt=new Date().toISOString(),page=await boundedDeclaredPublicRead(CAREERS_URL,{fetchImpl,signal,timeoutMs:Math.min(requestMs,sourceMs),overflowError:held('public response body bound exceeded')}),bytes=Buffer.from(page.bodyBase64,'base64')
    check();const headers=Object.fromEntries(['content-type','date','server','last-modified','content-encoding'].filter(key=>typeof page.headers[key]==='string').map(key=>[key,page.headers[key]])),receipt={url:CAREERS_URL,requestedURL:CAREERS_URL,method:'GET',finalURL:page.url,status:page.status,headers,headerStorage:'selected diagnostic headers; cookies and authorization omitted',requestedAt,completedAt:new Date().toISOString(),bodyBytes:bytes.length,bodySHA256:sha(bytes)}
    receipts.push(receipt);if(bytes.length<=2*1024*1024)retained.push({...receipt,rawBodyBase64:page.bodyBase64})
    html=bytes.toString('utf8')
    if(page.status===403||page.status===429||/<title[^>]*>\s*(?:access denied|forbidden|just a moment)/i.test(html))throw Object.assign(Error('SEW public GET HTTP '+page.status+' access challenge; no retry'),{status:page.status,code:'SEW_PUBLIC_ACCESS_DENIED',softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied',abortRetries:true})
    need(page.status===200&&page.url===CAREERS_URL&&['text/html','application/xhtml+xml'].includes((page.headers['content-type']||'').split(';')[0].trim().toLowerCase()),'public status, final URL or MIME changed')
    need(bytes.length<=4e6,'public HTML body bound exceeded');firstParty=true
   }
   check();const all=extractOpenings(html);observed=all.length;check();const selected=maxJobs?all.slice(0,maxJobs):all,deniedOrigins=new Set()
   for(const job of all){
    if(!selected.includes(job)){failures.push({stage:'native-detail',id:job.jobId,name:'DetailBudgetHold',message:'Candidate retained outside selected row budget.'});continue}
    const origin=job.sourceDeclaredPDFURL?new URL(job.sourceDeclaredPDFURL).origin:null
    if(fetchDocumentText&&job.sourceDeclaredPDFURLAllowed&&!deniedOrigins.has(origin)){
     try{const text=await diagnosticRead(s=>fetchDocumentText(job.sourceDeclaredPDFURL,{signal:s}));need(typeof text==='string'&&Buffer.byteLength(text)<=4e6,'diagnostic detail text is malformed or oversized');check();job.sourceUnverifiedDetailDiagnostic={textBytes:Buffer.byteLength(text),textSHA256:sha(text),provenance:'metadata-free callback; no own PDF identity/employer/country/criteria qualification'}
     }catch(error){check();job.sourceDetailFailure=boundedFailure(error);job.sourceDetailFailureKind='native-detail-read-failed';if(classifyScraperError(error).failureKind==='blocked_or_access_denied')deniedOrigins.add(origin)}
    }else if(fetchDocumentText&&deniedOrigins.has(origin)){job.sourceDetailFailureKind='native-pdf-origin-denied';job.sourceDetailFailure={name:'PublicOriginHeld',message:'Earlier native detail diagnostic denied this origin; no retry.'}}
    failures.push({stage:'native-detail',id:job.jobId,...job.sourceDetailFailure})
   }
   check();const now=new Date().toISOString(),jobs=selected.map(job=>({...job,scrapedAt:now}))
   const collection={source:SOURCE,observedListingCount:all.length,candidateDetails:all.length,extractedDetailJobs:0,excludedDetailJobs:0,jobs:[],failures,listingPaginationComplete:false,closingInventoryMatches:false,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,candidateListingRecords:all.map(j=>({internalJobId:j.jobId,internalIdKind:'derived-listing',...j.sourceNativeListingCells})),retainedResponses:retained,transportPackets:receipts}
   if(jobs[0])jobs[0].nativeCollectionEvidence=collection
   attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:all.length,observedVacancyCount:all.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
   Object.defineProperty(jobs,'nativeCollectionEvidence',{value:collection,configurable:true})
   attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'Own native PDF contract/country/full criteria unverified; no complete inventory or cleanup proof.'})
   check();return jobs
  }catch(error){check();error.abortRetries=true;error.nativeEvidence={source:SOURCE,observedListingCount:observed,inventoryComplete:false,lifecycleCleanupAllowed:false,failures:[{stage:'native-listing',...boundedFailure(error)}],transportPackets:receipts,retainedResponses:retained};throw error}
  finally{clearTimeout(timer)}
 }}
}
