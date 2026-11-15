import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CURRENT_SMARTSTREAM_PROFILE as PROFILE} from './currentProfile.js'

const SOURCE='smartstreamtechnologies',JSON_BYTES=256*1024
const ACCOUNT=PROFILE.accountURL,LISTING=PROFILE.listingURL,CLIENT=PROFILE.client.url
const detailURL=shortcode=>'https://apply.workable.com/api/v2/accounts/smartstream/jobs/'+shortcode
const hash=value=>createHash('sha256').update(value).digest('hex')
const same=(left,right)=>canonicalNativeRecord(left)===canonicalNativeRecord(right)
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,fields)=>object(value)&&same(Object.keys(value).sort(),[...fields].sort())
const fail=(message,fields={})=>firstPartyFailure(SOURCE,message,{nativeAuthorityFailure:true,sourceScopeComplete:false,...fields})
const need=(condition,message)=>{if(!condition)throw fail(message)}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const DEFAULTS={sourceTimeoutMs:45000,requestTimeoutMs:15000,maxRequests:16,maxPages:6,maxDetails:8,maxEntityBytes:4000000,maxTotalBytes:24000000}

// Original entity bytes, not Response.text(), qualify the program and JSON.
// Interposition enforces this source's stricter stream and aggregate ceilings
// before the shared transport admits any chunk to its buffers.
export function createSmartStreamOriginalReader(options={}){
 const caller=options.signal
 caller?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson,'Original HTTP metadata is required; body-only callbacks cannot qualify native data')
 for(const name of ['fetchImpl','fetchPage'])need(options[name]===undefined||typeof options[name]==='function','Invalid native transport callback')
 const limits=Object.fromEntries(Object.entries(DEFAULTS).map(([name,maximum])=>{
  const value=options[name]??maximum
  need(Number.isSafeInteger(value)&&value>0&&value<=maximum,'Invalid native '+name+' ceiling')
  return[name,value]
 }))
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal
 const started=performance.now(),receipts=[]
 let totalBytes=0,discoveryPages=0,detailReads=0,closed=false,inFlight=false
 const expire=()=>controller.abort(new DOMException('SmartStream source deadline exceeded','TimeoutError'))
 const timer=setTimeout(expire,limits.sourceTimeoutMs)
 const check=()=>{
  caller?.throwIfAborted()
  if(performance.now()-started>=limits.sourceTimeoutMs&&!controller.signal.aborted)expire()
  signal.throwIfAborted()
  need(!closed,'Original native reader is closed')
 }
 const admitted=new Map([[ACCOUNT,'json'],[CLIENT,'javascript'],[LISTING,'json'],...PROFILE.roles.map(role=>[detailURL(role.shortcode),'detail'])])
 return{check,limits,jsonCeiling:Math.min(limits.maxEntityBytes,JSON_BYTES),
  async read(url,{reserveBytes=0,phase='opening'}={}){
   check()
   const kind=admitted.get(url),detail=kind==='detail',entityCeiling=kind==='javascript'?limits.maxEntityBytes:Math.min(limits.maxEntityBytes,JSON_BYTES)
   need(kind&&!inFlight&&receipts.length<limits.maxRequests,'Unbound or excessive original native request')
   need(['opening','closing'].includes(phase),'Unqualified native acquisition phase')
   need(Number.isSafeInteger(reserveBytes)&&reserveBytes>=0&&totalBytes+reserveBytes<limits.maxTotalBytes,'Insufficient reserved closing byte budget')
   need(detail?detailReads<limits.maxDetails:discoveryPages<limits.maxPages,'Original native discovery/detail budget exceeded')
   // Opening gets at most half the source deadline, retaining time for every
   // closing observation. Neither phase can extend the original request cap.
   const remaining=(phase==='opening'?limits.sourceTimeoutMs/2:limits.sourceTimeoutMs)-(performance.now()-started)
   need(remaining>=1,'Insufficient reserved closing time budget')
   const timeoutMs=Math.max(1,Math.min(limits.requestTimeoutMs,Math.floor(remaining)))
   if(detail)detailReads++;else discoveryPages++
   const method=url===LISTING?'POST':'GET',receipt={requestedUrl:url,method,phase,requestedAt:new Date().toISOString(),bodyComplete:false}
   receipts.push(receipt);inFlight=true
   try{
    const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs,request:method==='POST'?{method,body:'{}'}:{method},overflowError:fail('Original native entity byte budget exceeded'),fetchImpl:async(requested,init)=>{
     const verify=()=>{check();init.signal.throwIfAborted()}
     verify()
     let original
     const request={...init,redirect:'manual',credentials:'omit',cache:'no-store',headers:{
      Accept:kind==='javascript'?'*/*':'application/json, text/plain, */*',
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      ...(method==='POST'?{'Content-Type':'application/json'}:{}),
     }}
     try{
      if(options.fetchImpl)original=await options.fetchImpl(requested,request)
      else if(options.fetchPage){
       const value=await options.fetchPage(requested,request)
       verify()
       need(value&&typeof value.bodyBase64==='string'&&Number.isInteger(value.status)&&typeof(value.finalUrl??value.url)==='string'&&object(value.headers),'Original entity bytes and HTTP metadata are required')
       need(value.redirected===false,'Original native redirect authority is required')
       need(value.bodyBase64.length<=Math.ceil(entityCeiling/3)*4,'Original native entity byte budget exceeded')
       const bytes=Buffer.from(value.bodyBase64,'base64')
       need(bytes.toString('base64')===value.bodyBase64&&(!value.sha256||hash(bytes)===value.sha256)&&(value.bytes===undefined||value.bytes===bytes.length),'Original native byte receipt mismatch')
       original=new Response(bytes,{status:value.status,headers:value.headers})
       Object.defineProperty(original,'url',{value:value.finalUrl??value.url})
      }else original=await fetch(requested,request)
      verify()
      need(original&&Number.isInteger(original.status)&&typeof original.url==='string'&&typeof original.headers?.get==='function','Original Response HTTP metadata is required')
      Object.assign(receipt,{status:original.status,finalUrl:original.url,redirected:original.redirected,contentType:original.headers.get('content-type')??''})
      need(original.redirected===false,'Original native redirect authority changed or unavailable')
      need(original.url===url,'Original native final URL changed')
      if(original.status!==200)throw fail('Original native HTTP '+original.status,{status:original.status,requestUrl:url})
      need(receipt.contentType===(kind==='javascript'?'application/javascript':'application/json; charset=utf-8'),'Original native '+kind+' MIME changed')
      const body=original.body
      let entityBytes=0
      return{status:original.status,url:original.url,headers:original.headers,body:body===null?null:{cancel:reason=>body.cancel(reason),getReader(){
       verify()
       const reader=body.getReader()
       return{async read(){
        verify()
        const chunk=await reader.read()
        verify()
        if(!chunk.done){
         need(types.isUint8Array(chunk.value),'Original native chunk is not a byte array')
         const length=byteLength.call(chunk.value)
         entityBytes+=length;totalBytes+=length;receipt.bytesReceived=entityBytes
         need(entityBytes<=entityCeiling,'Original native entity byte budget exceeded')
         need(totalBytes+reserveBytes<=limits.maxTotalBytes,'Aggregate original native byte budget or closing reserve exceeded')
        }
        return chunk
       },cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}}
     }catch(error){ignore(()=>original?.body?.cancel(error));throw error}
    }})
    check()
    const bytes=Buffer.from(page.bodyBase64,'base64')
    Object.assign(receipt,{bytes:bytes.length,sha256:hash(bytes),bodyComplete:true})
    if(kind==='javascript')need(bytes.length===PROFILE.client.bytes&&receipt.sha256===PROFILE.client.sha256,'Reviewed whole role-client original entity changed')
    need(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'Original native BOM requires review')
    let body
    try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch(cause){throw fail('Original native UTF8 entity is invalid',{cause})}
    check()
    return{url,body,bytes,sha256:receipt.sha256}
   }catch(error){caller?.throwIfAborted();check();throw error}
   finally{receipt.completedAt=new Date().toISOString();inFlight=false}
  },
  stats:()=>({...limits,requests:receipts.length,discoveryPages,detailReads,decodedBytes:totalBytes,receipts:structuredClone(receipts)}),
  close(){closed=true;clearTimeout(timer);controller.abort()},
 }
}

function literal(node){
 if(node?.type==='Literal'){
  need(node.regex===undefined&&(node.value===null||['string','number','boolean'].includes(typeof node.value)),'Unreviewed native literal')
  return node.value
 }
 if(node?.type==='ArrayExpression'){
  need(node.elements.every(Boolean),'Sparse native data requires review')
  return node.elements.map(literal)
 }
 need(node?.type==='ObjectExpression','Native JSON is not a complete literal')
 const value={}
 for(const field of node.properties){
  need(field.type==='Property'&&!field.computed&&!field.method&&field.kind==='init','Computed native JSON requires review')
  const name=field.key.name??field.key.value
  need(typeof name==='string'&&!['__proto__','constructor','prototype'].includes(name)&&!Object.hasOwn(value,name),'Duplicate or unsafe native JSON field')
  value[name]=literal(field.value)
 }
 return value
}
export function readSmartStreamJSON(text){
 need(typeof text==='string'&&Buffer.byteLength(text)<=JSON_BYTES,'Missing or excessive native JSON')
 let value,ast
 try{value=JSON.parse(text);ast=parse('('+text+')',{ecmaVersion:'latest'})}catch(cause){throw fail('Malformed original native JSON',{cause})}
 need(ast.body.length===1&&ast.body[0].type==='ExpressionStatement','Original native JSON expression changed')
 need(same(value,literal(ast.body[0].expression)),'Original native JSON data changed')
 return value
}
export function readSmartStreamAccount(body){
 const account=readSmartStreamJSON(body)
 need(same(account,PROFILE.account),'Current complete native legal employer/official-site metadata changed')
 return account
}
const text=value=>typeof value==='string'&&value.length<=32000
function locationShape(location,secondary=false){
 need(keys(location,secondary?['city','country','countryCode','hidden','region']:['city','country','countryCode','region']),'Native full location schema changed')
 need(['city','country','countryCode','region'].every(name=>text(location[name]))&&(!secondary||typeof location.hidden==='boolean'),'Native country/location field type changed')
}
const india=row=>row.location.country==='India'&&row.location.countryCode==='IN'&&row.locations.length>0&&row.locations.every(location=>location.country==='India'&&location.countryCode==='IN'&&location.hidden===false)
function rowShape(row,{detail=false}={}){
 const fields=detail?PROFILE.detailFields:PROFILE.listingFields
 const actual=Object.keys(row??{})
 // Two genuine unhydrated first-page rows omit type. That exact optional
 // listing field never authorizes a full-detail role or inferred criteria.
 need(keys(row,fields)||!detail&&!Object.hasOwn(row,'type')&&keys(row,fields.filter(name=>name!=='type')),'Native complete role schema changed')
 need(Number.isSafeInteger(row.id)&&row.id>0&&/^[A-F0-9]{10}$/.test(row.shortcode)&&text(row.title)&&row.title.trim(),'Native role identity changed')
 need(typeof row.remote==='boolean'&&typeof row.isInternal==='boolean'&&(row.code===null||text(row.code)),'Native role field type changed')
 need(row.accountUid===PROFILE.account.uid&&text(row.state)&&text(row.approvalStatus)&&text(row.language)&&text(row.workplace),'Native role account or status changed')
 need(!Object.hasOwn(row,'type')||text(row.type),'Native role type changed')
 need(Array.isArray(row.department)&&row.department.length<=16&&row.department.every(text),'Native department criteria changed')
 locationShape(row.location)
 need(Array.isArray(row.locations)&&row.locations.length>0&&row.locations.length<=32,'Native complete secondary locations changed')
 row.locations.forEach(location=>locationShape(location,true))
 need(text(row.published)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.published)&&Number.isFinite(Date.parse(row.published))&&new Date(row.published).toISOString()===row.published,'Native published date is invalid')
 need(actual.length===fields.length||!detail&&actual.length===fields.length-1,'Native complete field count changed')
}
export function readSmartStreamListing(body){
 const page=readSmartStreamJSON(body)
 need(keys(page,['nextPage','results','total'])&&Number.isSafeInteger(page.total)&&page.total>=0&&page.total<=1000000,'Native first-page inventory schema changed')
 need(Array.isArray(page.results)&&page.results.length===10&&page.total>=page.results.length,'Native observed first-page count changed')
 need(typeof page.nextPage==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(page.nextPage)&&page.nextPage.length<=256,'Native unvisited next-page declaration changed')
 const ids=new Set(),codes=new Set()
 for(const row of page.results){
  rowShape(row)
  need(!ids.has(row.id)&&!codes.has(row.shortcode),'Duplicate native listing role identity')
  ids.add(row.id);codes.add(row.shortcode)
 }
 return page
}
function selectedRows(page){
 return PROFILE.roles.map(role=>{
  const row=page.results.find(candidate=>candidate.id===role.id)
  need(row&&row.shortcode===role.shortcode&&row.title===role.title,'Reviewed full role is not in current first page')
  need(india(row),'Native selected role explicit primary/all-secondary India country proof changed')
  need(row.state==='published'&&row.approvalStatus==='approved'&&row.isInternal===false,'Native role is unpublished, unapproved or internal')
  need(same(row,role.listing),'Reviewed selected native listing criteria changed')
  return row
 })
}
export function readSmartStreamDetail(body,row,observedAt){
 const record=readSmartStreamJSON(body)
 rowShape(record,{detail:true})
 const expected=PROFILE.roles.find(role=>role.id===record.id&&role.shortcode===record.shortcode)
 need(expected,'Unreviewed native full role identity')
 for(const name of PROFILE.listingFields)need(same(record[name],row[name]),'Native listing/detail '+name+' mismatch')
 need(india(record),'Native detail explicit primary/all-secondary India country proof changed')
 need(record.state==='published'&&record.approvalStatus==='approved'&&record.isInternal===false,'Native full role is unpublished, unapproved or internal')
 need(Date.parse(record.published)<=Date.parse(observedAt),'Native published date is in the future')
 const structured=Object.fromEntries(Object.entries(record).filter(([name])=>name.startsWith('salary_')))
 need(same(structured,expected.structuredCriteria),'Reviewed complete native salary criteria changed')
 for(const name of ['description','requirements','benefits']){
  const value=record[name],reviewed=expected.richFields[name]
  need(typeof value==='string'&&Buffer.byteLength(value)===reviewed.bytes&&hash(value)===reviewed.sha256,'Reviewed complete native '+name+' criteria changed')
 }
 const combined=[record.description,record.requirements,record.benefits].filter(Boolean).join('')
 const criteria=readOriginalNativeCriteria(combined,fail)
 need(criteria.sourceDetailComplete,'Native full criteria unavailable')
 need(!/\b(?:(?:this|the) (?:job|role|position|vacancy) (?:is |has been |has )?(?:closed|filled|expired)|(?:we are |we're )?no longer accepting applications|applications? (?:are |have been )?closed)\b/i.test(criteria.sourceDescription),'Explicit native closed role notice')
 return{record,criteria,combined}
}

export async function runCurrentSmartStream(options={}){
 const reader=createSmartStreamOriginalReader(options)
 try{
  need(options.now===undefined||typeof options.now==='function','Invalid native observation clock')
  const observedAt=(options.now??(()=>new Date().toISOString()))()
  need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Invalid native observation clock')
  need(reader.limits.maxRequests>=14&&reader.limits.maxPages>=6&&reader.limits.maxDetails>=8,'Insufficient native budget for four complete opening/closing pairs')
  need(reader.limits.maxEntityBytes>=PROFILE.client.bytes,'Insufficient native whole-client entity budget')
  const closingReserve=PROFILE.client.bytes+6*reader.jsonCeiling
  const openingAccount=readSmartStreamAccount((await reader.read(ACCOUNT,{reserveBytes:closingReserve})).body)
  await reader.read(CLIENT,{reserveBytes:closingReserve})
  const opening=readSmartStreamListing((await reader.read(LISTING,{reserveBytes:closingReserve})).body),rows=selectedRows(opening),first=[]
  for(const row of rows)first.push(readSmartStreamDetail((await reader.read(detailURL(row.shortcode),{reserveBytes:closingReserve})).body,row,observedAt))
  let reserve=closingReserve-reader.jsonCeiling
  const lastAccount=readSmartStreamAccount((await reader.read(ACCOUNT,{phase:'closing',reserveBytes:reserve})).body)
  need(same(openingAccount,lastAccount),'Complete native employer metadata changed at closing')
  reserve-=PROFILE.client.bytes
  await reader.read(CLIENT,{phase:'closing',reserveBytes:reserve})
  reserve-=reader.jsonCeiling
  const closing=readSmartStreamListing((await reader.read(LISTING,{phase:'closing',reserveBytes:reserve})).body)
  need(same(opening,closing),'Whole ordered native first-page inventory changed at closing')
  const closingRows=selectedRows(closing),last=[]
  for(const row of closingRows){
   reserve-=reader.jsonCeiling
   last.push(readSmartStreamDetail((await reader.read(detailURL(row.shortcode),{phase:'closing',reserveBytes:reserve})).body,row,observedAt))
  }
  need(first.every((detail,index)=>same(detail.record,last[index].record)),'Complete original full detail changed at closing')
  const jobs=first.map(({record,criteria,combined},index)=>({
   ...criteria,sourceDescription:combined,jobDescription:combined,sourceDescriptionHTML:combined,sourceDescriptionText:criteria.sourceDescription,
   sourceNativeDescription:record.description,sourceNativeRequirements:record.requirements,sourceNativeBenefits:record.benefits,
   source:SOURCE,company:'SmartStream Technologies',title:record.title,jobId:String(record.id),requisitionId:record.shortcode,
   sourceUrl:PROFILE.roles[index].landingURL,applyUrl:null,link:null,nativeApplicationURL:null,nativeApplicationActionVerified:false,
   nativeJobLandingURL:PROFILE.roles[index].landingURL,nativeLandingURLMethod:PROFILE.nativeProtocolReview.landingMethod,
   nativeDetailAPIProvenance:detailURL(record.shortcode),nativePriorHeadObservation:index===0?PROFILE.priorSingleHeadObservation:null,
   country:'India',location:[record.location.city,record.location.region,record.location.country].filter(Boolean).join(', '),city:record.location.city,state:record.location.region,
   employmentType:record.type,department:record.department,postingDate:record.published,nativePublished:record.published,closingDate:null,
   nativePublicationDateProvenance:'original-native-published-consumed-by-native-eager-JobPosting-datePosted',nativeFirstEverPublicationUnverified:true,
   sourceNativeListingRecord:rows[index],sourceNativeDetailRecord:record,sourceNativeClosingListingRecord:closingRows[index],sourceNativeClosingDetailRecord:last[index].record,
   nativeEmployerBinding:{method:'current-own-native-legal-organization-and-official-website;historical-corporate-handoff-only',id:openingAccount.id,uid:openingAccount.uid,legalName:openingAccount.name,officialWebsite:openingAccount.url},
   sourceClosingReconciled:true,nativeCriteriaTextComplete:true,sourceDetailCompleteMeaning:PROFILE.sourceDetailCompleteMeaning,
   currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,applicationQuestionsCoverage:false,
   sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,currentCorporateBindingVerified:false,
   sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
   scrapedAt:observedAt,companyCareerPage:'https://smart.stream/careers/',companyDomain:'smart.stream',atsPlatform:'workable',
  }))
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.results.length,observedVacancyCount:opening.results.length,
   advertisedNativeTotal:opening.total,unseenAdvertisedCount:opening.total-opening.results.length,returnedCount:jobs.length,hydratedRecordCount:jobs.length,unhydratedRecordCount:opening.results.length-jobs.length,
   companyIndiaTotal:null,companyGlobalTotal:null,paginationFollowed:false,nextPageDeclared:true,
   originalOpeningPage:opening,originalClosingPage:closing,unhydratedRecords:opening.results.filter(row=>!jobs.some(job=>job.jobId===String(row.id))),
   unknownOrForeignCountryRecordCount:opening.results.filter(row=>!india(row)).length,
   unpublishedOrInternalRecordCount:opening.results.filter(row=>row.state!=='published'||row.approvalStatus!=='approved'||row.isInternal).length,
   originalOpeningAccount:openingAccount,originalClosingAccount:lastAccount,nativeDataAuthority:PROFILE.nativeProtocolReview,
   historicalCorporateHandoff:PROFILE.historicalCorporateHandoff,observedCorporateBlock:PROFILE.observedCorporateBlock,currentCorporateBindingVerified:false,
   priorSingleHeadObservation:PROFILE.priorSingleHeadObservation,currentHTMLQualification:false,
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,applicationQuestionsCoverage:false,
   openingClosingAccountMatch:true,openingClosingListingMatch:true,openingClosingDetailMatch:true,
   publicationDateSemantics:'Original native published is consumed by native eager JobPosting.datePosted; first-ever publication remains unverified. Existing age policy unchanged.',
   holds:['unvisited-native-pages','enumerated-undetailed-records','historical-only-corporate-binding-current403','company-scope-unverified','current-CSS-and-dependency-closure-unverified','rendered-activation-unverified','application-questions-and-action-unobserved','lifecycle-cleanup-forbidden'],
   reader:reader.stats(),observationTime:observedAt}
  attachSourceObservationEvidence(jobs,audit)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LISTING,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   reportedTotal:opening.total,indiaFacetCount:null,pagesFetched:audit.reader.requests,verifiedAt:observedAt,
   reason:'exact-own-native-data-four-complete-criteria-pairs-and-closing;unvisited-pages-and-undetailed-rows;company-CSS-dependencies-rendering-application-cleanup-held'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded')
  reader.check()
  return jobs
 }finally{reader.close()}
}
