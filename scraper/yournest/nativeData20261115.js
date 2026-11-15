import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {types,isDeepStrictEqual} from 'node:util'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence,normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import candidate from './catalog-candidate.json' with {type:'json'}

const PROFILE=JSON.parse(readFileSync(new URL('./reviewedNativeData20261115.json',import.meta.url),'utf8'))
export const SOURCE='yournest',COMPANY='YourNest',BOARD_URL=PROFILE.boardUrl,LIST_URL=PROFILE.listUrl
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
const sha=value=>createHash('sha256').update(value).digest('hex'),same=isDeepStrictEqual
const defaults={sourceTimeoutMs:30000,requestTimeoutMs:15000,maxRequests:20,maxEntityBytes:4000000,maxTotalBytes:24000000}
const HTML_BYTES=524288,JSON_BYTES=131072,CLOSING_READS=10,CLOSING_BYTES=5*(HTML_BYTES+JSON_BYTES)
const USER_AGENT='Mozilla/5.0 (compatible; Jobverify careers inventory check)'
const entities=new Map(PROFILE.entities.map(entity=>[entity.requestedUrl,entity]))
const evidence=(pagesFetched=0,reason='native-data-inventory-unqualified')=>normalizeInventoryEvidence({status:'coverage-gap',surface:BOARD_URL,firstParty:false,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason})
const gap=(message,fields={})=>firstPartyFailure(SOURCE,message,{code:'YOURNEST_COVERAGE_GAP',partial:true,nativeAuthorityFailure:true,sourceListingComplete:false,sourceScopeComplete:false,sourceCorporateBindingQualified:false,inventoryEvidence:evidence(),...fields})
const need=(condition,message)=>{if(!condition)throw gap(message)}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const typedArray=Object.getPrototypeOf(Uint8Array.prototype),intrinsic=name=>Object.getOwnPropertyDescriptor(typedArray,name).get
const byteLength=intrinsic('byteLength'),byteOffset=intrinsic('byteOffset'),arrayBuffer=intrinsic('buffer')

function pin(page,label){
 const expected=entities.get(page.url)
 need(expected&&expected.label===label&&Buffer.isBuffer(page.bytes)&&typeof page.text==='string'&&Buffer.from(page.text).equals(page.bytes),'Original native carrier/representation identity changed')
 need(page.bytes.length===expected.bytes&&sha(page.bytes)===expected.sha256,'Complete original '+label+' bytes changed')
}
function json(text){try{return JSON.parse(text)}catch{throw gap('Original JSON representation changed')}}
const allNodes=root=>[root,...root.children.filter(child=>typeof child!=='string').flatMap(allNodes)]
function ownedData(page,role){
 const doc=readNativeDocument(page.text),root=doc.nodes(node=>node.tag==='root')[0],nodes=allNodes(root)
 const scripts=nodes.filter(node=>node.tag==='script'&&node.attrs.id==='__NEXT_DATA__')
 need(scripts.length===1&&doc.nodes(node=>node===scripts[0]).length===1&&scripts[0].attrs.type==='application/json'&&!Object.hasOwn(scripts[0].attrs,'src'),'Original active native SSR owner changed')
 const ssr=json(scripts[0].raw)
 need(same(ssr,role?role.FullSSR:PROFILE.boardFullSSR)&&same(ssr.props?.pageProps?.companyDetails,PROFILE.company),'Complete native SSR/company model changed')
 const company=ssr.props.pageProps.companyDetails
 need(company.id===6566&&company.uuid==='987EE7EF32'&&company.name==='YourNest Venture Capital'&&company.url==='https://yournest.in/'&&company.slug==='yournest-venture-capital','Original native account/employer binding changed')
 if(!role)return{ssr}
 const carriers=nodes.filter(node=>node.tag==='script'&&node.attrs.type==='application/ld+json')
 need(carriers.length===1&&doc.nodes(node=>node===carriers[0]).length===1&&!Object.hasOwn(carriers[0].attrs,'src'),'Original own JobPosting owner changed')
 const schema=json(carriers[0].raw),links=nodes.filter(node=>node.tag==='a'&&(node.attrs.href??'').includes('apply_now=true'))
 need(same(schema,role.JobPosting)&&links.length===1&&links[0].attrs.href===role.rawApplyHref,'Complete native schema or original unresolved Apply declaration changed')
 return{ssr,schema,rawApplyHref:links[0].attrs.href}
}
export function readYourNestBoard(page){pin(page,'board');return ownedData(page)}
export function readYourNestListing(page){
 pin(page,'listing');const value=json(page.text)
 need(same(value,PROFILE.listing)&&value.count===4&&value.results.length===4&&value.next===null&&value.previous===null,'Whole ordered four-record native listing changed')
 need(new Set(value.results.map(row=>row.id)).size===4,'Duplicate original native row')
 return value
}
function date(raw){
 need(typeof raw==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}\+05:30$/.test(raw)&&Number.isFinite(Date.parse(raw)),'Original offset/microsecond date changed')
 const ms=Date.parse(raw)
 need(new Date(ms+19800000).toISOString().slice(0,19)===raw.slice(0,19),'Impossible original native calendar')
 return{raw,iso:new Date(ms).toISOString(),precision:'microsecond-original',ms}
}
const clock=value=>{
 const raw=typeof value==='function'?value():value??new Date(),ms=raw instanceof Date?raw.getTime():typeof raw==='string'?Date.parse(raw):NaN
 need(Number.isFinite(ms),'Invalid native source clock');return ms
}
export function readYourNestPair(apiPage,publicPage,row,now=new Date()){
 const role=PROFILE.roles.find(role=>role.id===row.id)
 need(role&&same(row,PROFILE.listing.results.find(value=>value.id===row.id)),'Unreviewed native role/listing identity')
 pin(apiPage,'api-'+row.id);pin(publicPage,'html-'+row.id)
 need(apiPage.url===role.apiUrl&&publicPage.url===role.publicUrl,'Original API/public role URL changed')
 const api=json(apiPage.text),publicData=ownedData(publicPage,role),schema=publicData.schema
 need(Object.keys(api).length===35&&same(api,role.APIRecord)&&same(api,publicData.ssr.props.pageProps.jobDetails),'Full35-field native API/SSR data changed')
 need(api.id===row.id&&api.uuid===role.uuid&&api.title===row.title&&schema.title===api.title&&schema.identifier.value===api.id&&api.email_domain==='yournest.in'&&api.published_internally===false,'Original own native identity/status changed')
 need(api.country==='India'&&row.country==='India'&&schema.jobLocation.address.addressCountry==='India'&&schema.applicantLocationRequirements.name==='India','Explicit native country disagreement')
 need(schema.hiringOrganization.name==='YourNest Venture Capital'&&schema.hiringOrganization.sameAs==='https://yournest.in/'&&schema.description===api.description&&typeof api.description==='string'&&api.description.length>0,'Original employer/full rich criteria disagreement')
 need(schema.datePosted===api.created_at&&schema.validThrough===api.valid_through,'Native JobPosting/API publication or expiry disagreement')
 const posted=date(api.created_at),closing=date(api.valid_through),observedAt=clock(now)
 need(closing.ms>=posted.ms&&posted.ms<=observedAt,'Original native date range is invalid or future')
 const exclusionReason=!role.ownEmployerRole?'generic-talent-pool':closing.ms<=observedAt?'native-expired':null
 return{id:api.id,row,api,ssr:publicData.ssr,schema,rawApplyHref:publicData.rawApplyHref,posted,closing,ownEmployerRole:role.ownEmployerRole,exclusionReason,sourceUrl:role.publicUrl}
}

export function createYourNestOriginalReader(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 need(options.maxJobs==null,'Native truncation is forbidden')
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'Original Response metadata is required; body-only callbacks are unsupported')
 need(options.fetchImpl===undefined||typeof options.fetchImpl==='function','Invalid original transport callback')
 const aliases=['timeoutMs','sourceTimeoutMs'].map(name=>options[name]).filter(value=>value!==undefined&&value!==null)
 need(aliases.every(value=>Number.isSafeInteger(value)&&value>0&&value<=defaults.sourceTimeoutMs),'Invalid source deadline ceiling')
 const limits=Object.fromEntries(Object.entries(defaults).map(([name,maximum])=>{const value=name==='sourceTimeoutMs'?Math.min(maximum,...aliases):options[name]??maximum;need(Number.isSafeInteger(value)&&value>0&&value<=maximum,'Invalid '+name+' ceiling');return[name,value]}))
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,started=performance.now(),receipts=[],lastStarts=new Map()
 let phase='opening',reservedReads=CLOSING_READS,reservedBytes=CLOSING_BYTES,decodedBytes=0,inFlight=false,closed=false
 const expire=()=>controller.abort(new DOMException('YourNest native source deadline exceeded','TimeoutError')),timer=setTimeout(expire,limits.sourceTimeoutMs)
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=limits.sourceTimeoutMs&&!controller.signal.aborted)expire();signal.throwIfAborted();need(!closed,'Original reader closed');need(phase!=='opening'||performance.now()-started<limits.sourceTimeoutMs/2,'Opening phase exhausted reserved closing time')}
 const pace=async url=>{
  const origin=new URL(url).origin
  while(lastStarts.has(origin)&&performance.now()-lastStarts.get(origin)<500){
   const ms=Math.ceil(500-(performance.now()-lastStarts.get(origin)))
   await new Promise((resolve,reject)=>{const aborted=()=>{clearTimeout(wait);reject(signal.reason)};const wait=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve()},ms);signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted()});check()
  }
  check();lastStarts.set(origin,performance.now())
 }
 return{check,limits,
  beginClosing(){check();need(!inFlight&&receipts.length===10&&receipts.every(receipt=>receipt.bodyComplete),'All opening originals must complete before closing');phase='closing'},
  async read(url){
   check();const entity=entities.get(url);need(entity&&!inFlight,'Unbound or concurrent native request');need(receipts.length<limits.maxRequests,'Original20-read ceiling exceeded')
   const isJSON=entity.kind==='json',ceiling=Math.min(limits.maxEntityBytes,isJSON?JSON_BYTES:HTML_BYTES)
   if(phase==='opening')need(receipts.length+1+reservedReads<=limits.maxRequests&&decodedBytes+reservedBytes<limits.maxTotalBytes,'Closing read/byte reserve unavailable')
   else{need(reservedReads>0&&reservedBytes>=ceiling,'Closing reserve exhausted');reservedReads--;reservedBytes-=isJSON?JSON_BYTES:HTML_BYTES}
   inFlight=true;let receipt
   try{
    await pace(url);const remaining=(phase==='opening'?limits.sourceTimeoutMs/2:limits.sourceTimeoutMs)-(performance.now()-started)
    need(remaining>=1,'No original phase time remains');const timeoutMs=Math.max(1,Math.min(limits.requestTimeoutMs,Math.floor(remaining)))
    receipt={requestedUrl:url,method:'GET',phase,startedAt:new Date().toISOString(),bodyComplete:false,requestTimeoutMs:timeoutMs,entityCeiling:ceiling,closingReadReserve:reservedReads,closingByteReserve:reservedBytes};receipts.push(receipt)
    const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs,overflowError:gap('Original entity byte ceiling exceeded'),fetchImpl:async(requested,init)=>{
     const verify=()=>{check();init.signal.throwIfAborted()};verify();let original
     try{
      original=await(options.fetchImpl??globalThis.fetch)(requested,{...init,method:'GET',redirect:'manual',credentials:'omit',headers:{'User-Agent':USER_AGENT,Accept:isJSON?'application/json':'text/html'}})
      verify();need(original&&Number.isInteger(original.status)&&typeof original.url==='string'&&typeof original.headers?.get==='function','Original Response HTTP metadata unavailable')
      Object.assign(receipt,{status:original.status,finalUrl:original.url,redirected:original.redirected,contentType:original.headers.get('content-type')??''})
      const stream=original.body;need(stream===null||typeof stream?.getReader==='function','Bounded original stream unavailable');let received=0
      return{status:original.status,url:original.url,headers:original.headers,body:stream===null?null:{cancel:reason=>stream.cancel(reason),getReader(){
       verify();const reader=stream.getReader()
       return{async read(){verify();const chunk=await reader.read();verify();if(!chunk.done){need(types.isUint8Array(chunk.value),'Original stream chunk must be Uint8Array');const size=byteLength.call(chunk.value);received+=size;decodedBytes+=size;receipt.bytesReceived=received;need(received<=ceiling,'Original per-kind/entity byte ceiling exceeded');need(decodedBytes+reservedBytes<=limits.maxTotalBytes,'Aggregate bytes or closing reserve exceeded');return{done:false,value:new Uint8Array(arrayBuffer.call(chunk.value),byteOffset.call(chunk.value),size)}}return chunk},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}}
     }catch(error){ignore(()=>original?.body?.cancel(error));throw error}
    }})
    const bytes=Buffer.from(page.bodyBase64,'base64');Object.assign(receipt,{bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64,bodyComplete:true})
    if(page.status!==200)throw gap('Original native HTTP '+page.status,{status:page.status,requestUrl:url})
    need(receipt.redirected===false&&page.url===url,'Original redirect/final URL changed')
    need((isJSON?/^application\/json(?:;\s*charset=(?:utf-8|"utf-8"))?$/i:/^text\/html(?:;\s*charset=(?:utf-8|"utf-8"))?$/i).test(receipt.contentType),'Original MIME/UTF8 charset changed')
    need(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'Original BOM requires review')
    let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw gap('Invalid original UTF8 representation')}
    need(Buffer.from(text).equals(bytes),'Original UTF8 is not lossless');check();return{url,bytes,text}
   }catch(error){
    caller?.throwIfAborted();signal.throwIfAborted()
    if(receipt?.status!==undefined&&receipt.status!==200&&error?.status!==receipt.status)throw gap('Original native HTTP '+receipt.status,{status:receipt.status,requestUrl:url,responseBodyError:error})
    throw error
   }finally{if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
  },
  stats:()=>({limits,phase,requests:receipts.length,decodedBytes,reservedClosingReads:reservedReads,reservedClosingBytes:reservedBytes,receipts:structuredClone(receipts)}),
  close(){closed=true;clearTimeout(timer);controller.abort()},
 }
}

export async function runCurrentYourNestData(options={}){
 const reader=createYourNestOriginalReader(options),observations=[]
 try{
  const now=clock(options.now),board=readYourNestBoard(await reader.read(BOARD_URL)),listing=readYourNestListing(await reader.read(LIST_URL))
  const readPair=async row=>{const known=PROFILE.roles.find(role=>role.id===row.id),api=await reader.read(known.apiUrl);pin(api,'api-'+row.id);return readYourNestPair(api,await reader.read(known.publicUrl),row,new Date(now))}
  for(const row of listing.results)observations.push(await readPair(row))
  reader.beginClosing()
  const lastBoard=readYourNestBoard(await reader.read(BOARD_URL)),lastListing=readYourNestListing(await reader.read(LIST_URL))
  need(same(board,lastBoard)&&same(listing,lastListing),'Complete native board/ordered listing closing changed')
  for(const observed of observations){const closing=await readPair(observed.row);need(same(observed,closing),'Complete original API/public role closing changed');observed.closingData=closing}
  const stats=reader.stats();need(stats.requests===20&&stats.reservedClosingReads===0&&stats.reservedClosingBytes===0,'All20 original observations must close')
  const jobs=observations.filter(row=>row.exclusionReason===null).map(row=>({source:SOURCE,company:COMPANY,companyName:COMPANY,jobId:String(row.id),sourceJobId:String(row.id),requisitionId:row.api.uuid,title:row.api.title,country:'India',location:row.api.location,
   sourceUrl:row.sourceUrl,url:row.sourceUrl,jobUrl:row.sourceUrl,nativeJobLandingURL:row.sourceUrl,applyUrl:null,link:null,nativeApplicationURL:null,nativeUnqualifiedApplyHref:row.rawApplyHref,nativeApplicationActionVerified:false,activeApplyVerified:false,applicationVisited:false,
   postingDate:row.posted.raw,datePosted:row.posted.raw,postedDate:row.posted.raw,closingDate:row.closing.raw,validThrough:row.closing.raw,nativeDetailPublicationDate:row.posted.raw,firstEverPublication:null,firstPublicationVerified:false,sourcePublicationProvenance:'Original native created_at agrees with own JobPosting.datePosted; first-ever-publication unverified',
   sourceDescription:row.api.description,jobDescription:row.api.description,description:row.api.description,nativeSourceRecord:structuredClone(row.api),nativeClosingSourceRecord:structuredClone(row.closingData.api),nativeSSRSourceRecord:structuredClone(row.ssr),nativeClosingSSRSourceRecord:structuredClone(row.closingData.ssr),nativeJobPostingSourceRecord:structuredClone(row.schema),nativeClosingJobPostingSourceRecord:structuredClone(row.closingData.schema),nativeHiringOrganization:structuredClone(row.schema.hiringOrganization),nativeLegalHiringOrganization:null,formalLegalEmployerQualified:false,nativeScreeningQuestions:structuredClone(row.api.job_screening_questions),
   nativeRemote:row.api.remote,nativeWorkplaceType:row.api.workplace_type,employmentType:row.schema.employmentType,nativeJobType:row.api.job_type,sourceDetailComplete:true,nativeCriteriaTextComplete:true,sourceDetailStatus:'complete',sourceCriteriaPresentation:'Full original native35field API/SSR/JobPosting criteria and screening questions as data; rendering/programs/CSS/application unqualified',
   firstParty:false,sourceCorporateBindingQualified:false,currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,applicationQuestionsCoverage:false,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:true}))
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD_URL,firstParty:false,listingComplete:false,pagesFetched:20,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date(now).toISOString(),reason:'finite-native-data-only;two-expired-own-roles-and-generic-portfolio-pool-excluded;corporate-company-executable-application-scope-unproven'})
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'mixed',observedRecordCount:4,observedVacancyCount:3,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,recordKind:'mixed',observedRecordCount:4,observedVacancyCount:3,nativeObservedRecordCount:4,nativeReportedBoardCount:4,companyGlobalTotal:null,companyIndiaTotal:null,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,firstParty:false,sourceCorporateBindingQualified:false,formalLegalEmployerQualified:false,activationVerified:false,currentCSSCoverage:false,clientDependencyCoverage:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,applicationInteractions:0,nativeCandidates:observations,originalResponses:stats.receipts,nativeOpeningBoard:board,nativeClosingBoard:lastBoard,nativeOpeningListing:listing,nativeClosingListing:lastListing,allOriginalNativeClosingReconciled:true,limits:stats.limits,originalDecodedBytes:stats.decodedBytes},configurable:true})
  return jobs
 }catch(error){
  options.signal?.throwIfAborted()
  const failure=error?.code==='YOURNEST_COVERAGE_GAP'||error?.name==='TimeoutError'?error:gap('Native transport, body or inventory unavailable',{cause:error,nativeAuthorityFailure:false})
  try{Object.assign(failure,{abortRetries:true,softFailure:true,lifecycleCleanupAllowed:false,sourceScopeComplete:false,inventoryEvidence:evidence(reader.stats().requests)});Object.defineProperty(failure,'recruitmentObservations',{value:{source:SOURCE,receipts:reader.stats().receipts,observations,firstParty:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null},enumerable:true,configurable:true})}catch{}
  throw failure
 }finally{reader.close()}
}
export const createYourNestNativeDataScraper=(options={})=>({source:SOURCE,run:extra=>runCurrentYourNestData({...options,...extra})})
export {runCurrentYourNestData as run}
