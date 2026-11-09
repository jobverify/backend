import {types} from 'node:util'
import {HOME,CAREERS,parseHome,parseListing,parseRoleHTML,parseMarkdown,parseNativeMarkdown,corporateAlignment,sha,roleCode} from './parser.js'
import {createNativeTransport,validateURL,redirectURL,MAX_BYTES} from './transport.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {collectNativeObservations} from './nativeObservations.js'
const data=(value,key)=>{for(let i=0;value&&typeof value==='object'&&i<5;i++){try{const p=Object.getOwnPropertyDescriptor(value,key);if(p)return p.value;value=Object.getPrototypeOf(value)}catch{return undefined}}}
const clean=v=>typeof v==='string'?v.slice(0,4096).replace(/https?:\/\/[^\s<>]+/gi,'[url]').replace(/\b(?:Bearer|Basic)\s+\S+/gi,'[redacted]').replace(/(["']?)\b(?:authorization|cookie|set-cookie|password|secret|api[-_]?key|(?:(?:access|refresh|id)[-_]?)?token)\1\s*[:=]\s*(?:"(?:\\.|[^"\\])*(?:"|$)|'(?:\\.|[^'\\])*(?:'|$)|[^\s,;}]+)/gi,'[redacted]').replace(/<[^>]*>[\s\S]*?(?:<\/[^>]*>|$)/g,'[markup]').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,320)||null:null
export function errorSummary(error,depth=0,seen=new Set()){if(typeof error==='string')return {name:null,message:clean(error),code:null,cause:null};if(!error||typeof error!=='object'||depth>2||seen.has(error))return null;seen.add(error);const name=data(error,'name'),code=data(error,'code');return {name:typeof name==='string'&&/^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(name)?name:null,message:clean(data(error,'message')),code:typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(code)?code:null,cause:depth<2?errorSummary(data(error,'cause'),depth+1,seen):null}}
import {optionsFor,createRuntime} from './runtime.js'
const FIRST_FAILURE=Symbol('IMTF original first failure')
const typed=Object.getPrototypeOf(Uint8Array.prototype),intrinsic=name=>Object.getOwnPropertyDescriptor(typed,name).get
const sourceByteLength=intrinsic('byteLength'),sourceByteOffset=intrinsic('byteOffset'),sourceBuffer=intrinsic('buffer')
export async function collect(input={}){
 const options=optionsFor(input),control=createRuntime(options)
 const r={status:'unknown',facts:[],jobs:[],candidates:[],failures:[],alignmentGaps:[],unknownRawFailures:[],retainedResponses:[],attempts:[],observedListingCount:null,rawJobs:null,indiaJobs:null,eligibleJobs:null,savedJobs:null,visibleJobs:null,cleanupAllowed:false,verifiedZeroInventory:false,notFoundCareersShortcodes:[],wholeCompanyScope:false,sourceScopeComplete:false,identityAssociation:'provisional-official-IMTF-brand-careers-handoff',legalEmployer:null,aliases:[]}
 const receipts=new WeakMap(),openingCache=new Map()
 const retain=(response,requestedURL)=>{
  let packet=receipts.get(response)
  if(!packet){packet={url:requestedURL,requestedURL,method:'GET',redirect:'manual',credentials:'omit'};receipts.set(response,packet);r.retainedResponses.push(packet)}
  const available=types.isUint8Array(response.body)?sourceByteLength.call(response.body):null
  const body=available!==null&&available<=MAX_BYTES?Buffer.from(new Uint8Array(sourceBuffer.call(response.body),sourceByteOffset.call(response.body),available)):null
  const reported=Number.isSafeInteger(response.receivedBodyBytes)&&response.receivedBodyBytes>=0?response.receivedBodyBytes:null
  const receivedBodyBytes=available===null?reported:Math.max(available,reported??0)
  Object.assign(packet,{finalURL:typeof response.url==='string'?response.url:null,status:response.status,headers:response.headers?{...response.headers}:null,bodyComplete:response.bodyComplete===true&&available!==null&&available<=MAX_BYTES,receivedBodyBytes,bodyBytes:body?.length??null,bodySHA256:body?sha(body):null,rawBodyBase64:body?.toString('base64')??null,provenance:response.provenance??null,requestedAt:response.requestedAt??null,completedAt:response.completedAt??null,headersObservedAt:response.headersObservedAt??null,bodyUnavailableReason:available>MAX_BYTES?'Materialized source entity exceeded the2MiB bound':response.bodyUnavailableReason??null})
  return packet
 }
 const transport=options.transport??createNativeTransport({...options,signal:control.signal,timeoutMs:options.readTimeoutMs,onReceipt:response=>retain(response,response.requestedURL??response.url)})
 const failure=(stage,error,candidate=null)=>{
  control.stop(error)
  if(!Object.hasOwn(r,FIRST_FAILURE))Object.defineProperty(r,FIRST_FAILURE,{value:error})
  r.failures.push({stage,...(errorSummary(error)??{name:null,message:null,code:null,cause:null})})
  if(candidate)r.unknownRawFailures.push({stage,candidate})
 }
 const read=async(url,kind,{fresh=false}={})=>{
  let current=url;const seen=new Set()
  for(let hop=0;hop<=3;hop++){
   validateURL(current,[current]);if(seen.has(current))throw Error('Redirect loop');seen.add(current)
   control.admit();r.attempts.push({requestedURL:current,method:'GET',redirect:'manual',credentials:'omit'})
   const response=await control.wait(async signal=>{
    const value=await transport(current,{advertised:[current],method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'text/html, application/json, text/markdown',...(fresh?{'Cache-Control':'no-cache',Pragma:'no-cache'}:{})},signal})
    // Retain a completed admitted response before enforcing elapsed deadlines.
    if(value&&typeof value==='object')retain(value,current)
    return value
   },options.readTimeoutMs,'IMTF_READ_TIMEOUT')
   if(!response||typeof response!=='object')throw Error('Invalid transport response types')
   const receipt=retain(response,current)
   if(response.url!==current||!Number.isInteger(response.status)||response.status<100||response.status>599||!response.headers||Array.isArray(response.headers))throw Error('Invalid transport response identity or headers')
   const headers=Object.fromEntries(Object.entries(response.headers).map(([k,v])=>[k.toLowerCase(),v]))
   if(Object.keys(headers).length!==Object.keys(response.headers).length)throw Error('Duplicate response header casing')
   if([301,302,303,307,308].includes(response.status)){
    if(roleCode(current)&&['/imtf/?not_found=true','https://apply.workable.com/imtf/?not_found=true'].includes(headers.location)){
     r.notFoundCareersShortcodes.push(roleCode(current));throw Object.assign(Error('Native role not found; primary advertised role unavailable'),{code:'IMTF_ROLE_NOT_FOUND',status:response.status})
    }
    if(hop===3)throw Error('Redirect depth exceeded')
    current=redirectURL(current,headers.location);continue
   }
   if(response.status!==200)throw Object.assign(Error('HTTP '+response.status+' upstream response'),{code:'IMTF_HTTP_ERROR',status:response.status,abortRetries:true,...([401,403,429,451].includes(response.status)?{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'}:{})})
   if(receipt.receivedBodyBytes>MAX_BYTES)throw Object.assign(Error('IMTF response exceeds2MiB materialized limit'),{code:'IMTF_BODY_LIMIT'})
   if(!receipt.bodyComplete)throw Error('Incomplete/oversized/different transport response')
   const type=headers['content-type']
   if(typeof type!=='string'||type.split(';')[0].trim().toLowerCase()!==(kind==='markdown'?'text/markdown':kind==='json'?'application/json':'text/html'))throw Error('Unexpected source content type')
   const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(receipt.rawBodyBase64,'base64'))
   if(!text.trim())throw Error('Empty source document')
   control.check();if(!fresh)openingCache.set(url,{kind,text});return text
  }
  throw Error('Incomplete redirects')
 }
 const finish=async()=>{
  options.signal?.throwIfAborted()
  r.requestCount=control.requests;r.admissionStopped=control.stopped
  r.status=r.failures.length?'partial':r.nativeObservationInventory?.closingConsistent?'retained-native-partial-observations':r.alignmentGaps.length?'partial':r.observedListingCount===null?'skipped':'retained-native-shape-valid'
  if(options.onAudit){try{await control.wait(()=>options.onAudit(r),options.auditTimeoutMs,'IMTF_AUDIT_TIMEOUT')}catch(error){options.signal?.throwIfAborted();if(!r.failures.length)throw error;r.auditSinkFailure=errorSummary(error)}}
  return r
 }
 try{
  if(options.maxJobs===0||options.maxPages===0)return await finish()
  let home,careers
  try{home=await read(HOME,'html')}catch(error){options.signal?.throwIfAborted();failure('official-home',error);return await finish()}
  try{const qualification=parseHome(home);control.check();if(qualification.failures.length)throw Object.assign(Error(qualification.failures[0].message),{code:'IMTF_SOURCE_SHAPE'})}
  catch(error){options.signal?.throwIfAborted();failure('official-home',error);return await finish()}
  try{careers=await read(CAREERS,'html')}catch(error){options.signal?.throwIfAborted();failure('official-careers',error);return await finish()}
  let listing
  try{listing=parseListing(home,careers);control.check()}catch(error){options.signal?.throwIfAborted();failure('native-listing',error);return await finish()}
  Object.assign(r,{observedListingCount:listing.observedListingCount,candidates:listing.candidates,rawDocuments:listing.rawDocuments,homeCareersHrefs:listing.homeCareersHrefs})
  for(const item of listing.failures){failure('native-listing',Object.assign(Error(item.message),{code:'IMTF_SOURCE_SHAPE'}));r.unknownRawFailures.push({stage:'native-listing',...item})}
  if(!listing.provenance||r.failures.length)return await finish()
  let anchor,recoveryRequested=false
  const isRoleUnavailable=(error,candidate)=>
   (!error||data(error,'code')==='IMTF_ROLE_NOT_FOUND')&&r.notFoundCareersShortcodes.includes(candidate.shortcode)&&r.retainedResponses.some(p=>p.requestedURL===candidate.url&&p.status===302&&['/imtf/?not_found=true','https://apply.workable.com/imtf/?not_found=true'].includes(p.headers?.location))
  for(const candidate of listing.candidates){
   let html,identity
   try{html=await read(candidate.url,'html');identity=parseRoleHTML(html,candidate);control.check()}
   catch(error){
    options.signal?.throwIfAborted()
    if(anchor&&isRoleUnavailable(error,candidate)){
     r.recoveryTrigger={stage:'role-html',...(errorSummary(error)??{}),candidate};recoveryRequested=true;break
    }
    failure('role-html',error,{...candidate,rawRoleHTML:html??null});break
   }
   try{
    const markdown=await read(identity.markdownURL,'markdown'),nativeFact=parseNativeMarkdown(markdown,identity),gaps=corporateAlignment(nativeFact,candidate,identity)
    if(anchor&&gaps.some(gap=>gap.field==='title'||gap.field==='employment')){
     // This typed cross-surface result follows native identity/content proof.
     // It does not catch or downgrade a native parser/acquisition exception.
     r.recoveryTrigger={stage:'corporate-native-alignment',code:'IMTF_CORPORATE_ALIGNMENT_GAP',message:'Unresolved corporate/native title or employment',originalCorporateGuard:{code:'IMTF_SOURCE_SHAPE',message:'Markdown title/employment/header mismatch'},candidate,nativeFact,gaps}
     recoveryRequested=true;break
    }
    const fact=parseMarkdown(markdown,candidate,identity);control.check();anchor??=identity
    r.facts.push(fact)
    if(fact.departmentAlignmentGap)r.alignmentGaps.push({stage:'role-department-alignment',name:'IMTFAlignmentGap',message:'Unresolved corporate/native department labels',code:'IMTF_DEPARTMENT_ALIGNMENT_GAP',...fact.departmentAlignmentGap,nativePublicURLShortcode:fact.nativePublicURLShortcode,nativeNumericJobId:fact.nativeNumericJobId,nativeAccountId:fact.nativeAccountId,canonicalURL:fact.canonicalURL,markdownURL:fact.markdownURL,nativeFullMarkdownSHA256:fact.nativeFullMarkdownSHA256})
    if(fact.country==='India')r.jobs.push(fact)
    else if(fact.country===null){failure('native-country',Error('Unrecognized explicit native country'),{candidate,fact});break}
   }catch(error){options.signal?.throwIfAborted();failure('role-markdown',error,{...candidate,...identity});break}
  }
  if(recoveryRequested){
   Object.assign(r,{primaryFacts:r.facts.slice(),primaryJobs:r.jobs.slice(),nativeObservations:[],unavailableCorporateReferences:[],primaryQualificationGaps:[r.recoveryTrigger],jobs:[]})
   r.facts=r.nativeObservations
   const openingRead=async(url,kind)=>{control.check();const cached=openingCache.get(url);return cached?.kind===kind?cached.text:read(url,kind)}
   try{await collectNativeObservations({read,openingRead,check:()=>control.check(),r,anchor,listing,home,isRoleUnavailable})}
   catch(error){options.signal?.throwIfAborted();failure('native-observations',error)}
  }
  return await finish()
 }finally{control.close()}
}

const plainMarkdown=s=>s.replace(/^#{1,2} /gm,'').replace(/\*\*/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').trim()
export function toJobs(r){return r.jobs.map(f=>({id:f.nativeNumericJobId,jobId:f.nativeNumericJobId,requisitionId:null,nativePublicURLShortcode:f.nativePublicURLShortcode,nativeNumericJobId:f.nativeNumericJobId,nativeAccountId:f.nativeAccountId,title:f.title,company:'IMTF',source:'imtf',sourceUrl:f.sourceURL,applyUrl:f.nativeApplicationURL,link:f.nativeApplicationURL,applicationVisited:false,location:f.listing.locationRaw,city:f.nativeCityRaw,country:f.country,isIndia:true,postingDate:f.nativePublicationRaw,postedAt:f.nativePublicationRaw,publicationPrecision:'day',publicationTimezone:null,firstEverPublication:null,nativeRequisitionId:null,closingDate:null,lifecycle:null,legalEmployer:null,jobDescription:plainMarkdown(f.sourceDescriptionMarkdown),sourceDescription:plainMarkdown(f.sourceDescriptionMarkdown),sourceDescriptionMarkdown:f.sourceDescriptionMarkdown,nativeFullMarkdown:f.nativeFullMarkdown,nativeFacts:f,nativeCollectionEvidence:r,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,publicEligibility:null}))}

export async function runNative(input={}){
 const options=optionsFor(input),r=await collect(options),first=r[FIRST_FAILURE]
 options.signal?.throwIfAborted()
 if(!r.jobs.length&&r.failures.length){
  const timeout=['IMTF_SOURCE_TIMEOUT','IMTF_READ_TIMEOUT'].includes(data(first,'code'))
  const error=timeout?first:Object.assign(new Error('IMTF native collection incomplete; no usable India jobs'),{name:'IMTFIncompleteError',code:'IMTF_NATIVE_INCOMPLETE',cause:r.failures[0]})
  Object.defineProperty(error,'nativeEvidence',{value:r,configurable:true,enumerable:true})
  for(const key of ['status','failureKind','softFailure','upstreamOutage','abortRetries']){const value=data(first,key);if(value!==undefined)Object.defineProperty(error,key,{value,configurable:true,enumerable:true})}
  throw error
 }
 const selected=options.maxJobs===null?r:{...r,jobs:r.jobs.slice(0,options.maxJobs)}
 const jobs=attachInventoryEvidence(toJobs(selected),{status:'coverage-gap',surface:CAREERS,firstParty:Boolean(r.homeCareersHrefs?.length),listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:r.retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason:(r.status==='skipped'?'caller-zero-cap-no-inventory-proof;':'provisional-official-IMTF-brand-handoff;whole-company-inventory-unknown;')+'native-state='+r.status+';partial-failures='+r.failures.length+';alignment-gaps='+r.alignmentGaps.length+';cleanup-forbidden'})
 if(r.nativeObservationInventory?.closingConsistent)attachSourceObservationEvidence(jobs,r)
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:r,configurable:true})
 Object.defineProperty(jobs,Symbol.for('jobverify.imtf-native-evidence'),{value:r})
 return jobs
}
