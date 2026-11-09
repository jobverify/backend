import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readNativeWithSignal} from '../../scraper-support/utils/nativePagination.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

export const CAREERS_URL='https://www.ai21.com/careers/'
const HOME='https://www.ai21.com/',SOURCE='ai21labs',BRAND='AI21 Labs'
const sha=value=>createHash('sha256').update(value).digest('hex')
const cls=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const children=node=>node.children.filter(value=>typeof value!=='string')
const descendants=(node,predicate)=>!node||node.inert?[]:[...(predicate(node)?[node]:[]),...children(node).flatMap(child=>descendants(child,predicate))]
const gap=message=>Object.assign(Error('AI21 native contract: '+message),{softFailure:true,upstreamOutage:false,failureKind:'coverage_gap',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const valid=(condition,message)=>{if(!condition)throw gap(message)}
const one=(nodes,label)=>{valid(nodes.length===1,'expected one '+label);return nodes[0]}
const nativeURL=value=>{
 let url;try{url=new URL(value)}catch{throw gap('invalid native role URL')}
 valid(url.origin==='https://www.ai21.com'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash
  &&/^\/careers\/[a-z0-9-]+\/[A-Z0-9]+\.[A-Z0-9]+\/$/.test(url.pathname),'native role URL changed')
 return url.href
}
const documentAt=(html,url)=>{
 const raw=readNativeDocument(html),doc=readVisibleNativeDocument(html)
 valid(!raw.nodes(n=>n.tag==='base').length,'unreviewed native base URL')
 valid(one(raw.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===url,'native canonical identity changed')
 const records=[]
 const visit=value=>{if(Array.isArray(value)){for(const item of value)visit(item);return}if(!value||typeof value!=='object')return;records.push(value);if(value['@graph'])visit(value['@graph'])}
 for(const script of raw.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.attrs.type==='application/ld+json')){
  try{visit(JSON.parse(script.raw))}catch{throw gap('invalid native identity schema')}
 }
 const employer=one(records.filter(value=>value['@type']==='Organization'),'native publisher organization')
 valid(employer.name===BRAND&&employer['@id']===HOME+'#organization'&&employer.url===HOME,'native publisher identity changed')
 return{raw,doc}
}
const listAt=info=>{
 const {raw,doc}=info
 one(doc.nodes(n=>n.tag==='h2'&&cls(n,'header__title')&&doc.text(n)==='Current openings'),'current openings heading')
 const active=raw.nodes(n=>n.tag==='a'&&cls(n,'position')),visible=doc.nodes(n=>n.tag==='a'&&cls(n,'position'))
 valid(active.length>0&&active.length<=500,'native positive card inventory unavailable or exceeds bound')
 const rows=[],seen=new Set()
 for(const anchor of active){
  const url=nativeURL(anchor.attrs.href),title=raw.text(one(descendants(anchor,n=>cls(n,'position__title')),'card title')),
   location=raw.text(one(descendants(anchor,n=>cls(n,'position__location')),'card location')),
   employmentType=raw.text(one(descendants(anchor,n=>cls(n,'position__type')),'card employment type'))
  valid(title&&location&&employmentType&&!seen.has(url),'native card identity missing or duplicated');seen.add(url)
  const current=visible.filter(n=>n.attrs.href===url)
  const isVisible=current.length===1&&doc.text(current[0])===raw.text(anchor)
  rows.push({id:new URL(url).pathname.split('/').at(-2),url,title,location,employmentType,nativeCardVisible:isVisible,
   country:null,legalEmployer:null,postingDate:null,closingDate:null,nativeEmployerBrand:BRAND,sourceDetailComplete:false,
   sections:[],criteria:{requirements:null},applicationVisited:false})
 }
 return rows
}
// Preserve each complete publisher section, in order. Empty publisher subsections
// remain empty; neither the listing teaser nor application embed supplies criteria.
const detailAt=(html,row)=>{
 const {raw,doc}=documentAt(html,row.url),career=one(doc.nodes(n=>cls(n,'career')),'native role container')
 const title=doc.text(one(descendants(career,n=>n.tag==='h1'&&cls(n,'career__title')),'native role title'))
 valid(title===row.title,'native card/detail title changed')
 const metadata=descendants(career,n=>cls(n,'career__meta-item')).map(n=>doc.text(n))
 valid(metadata.length===3&&metadata[0]===row.location&&metadata[2]===row.employmentType,'native card/detail metadata changed')
 const body=one(descendants(career,n=>cls(n,'career__details')),'native description body')
 const published=one(raw.nodes(n=>cls(n,'career__details')),'published native description body')
 const readSections=(node,d)=>descendants(node,n=>cls(n,'career__details-item')).map(section=>{
  const heading=d.text(one(descendants(section,n=>n.tag==='h2'&&cls(n,'details__item-title')),'native section heading'))
  const content=one(descendants(section,n=>cls(n,'details__item-text')),'native section content')
  return{heading,text:d.text(content),publishedEmpty:d.text(content)===''}
 })
 const sections=readSections(body,doc),nativeSections=readSections(published,raw)
 const expected=['Description','Role and Responsibilities','Requirements','About Us']
 const complete=JSON.stringify(sections)===JSON.stringify(nativeSections)&&sections.length===4
  &&expected.every((heading,index)=>sections[index]?.heading===heading)
  &&sections[0].text.length>=100&&sections[2].text.length>0&&sections[3].text.length>0
 valid(!/\b(?:this (?:job|role|position) (?:is|has been) (?:closed|filled)|no longer accepting applications)\b/i.test(doc.text(career)),'native role is no longer open')
 return{...row,department:metadata[1],sourceDetailComplete:complete,sections,
  criteria:{requirements:sections.find(s=>s.heading==='Requirements')?.text??null},
  jobDescription:sections.map(s=>s.heading+'\n'+s.text).join('\n\n'),
  nativeCountryEvidence:{listingLocation:row.location,detailLocation:metadata[0],explicitCountry:null},
  sourceDetailFailureKind:complete?null:'missing-content',nativeRoleDescriptionSHA256:sha(JSON.stringify(sections)),
  nativeApplicationEvidence:{rolePageURL:row.url,applyNowHeadingPresent:descendants(career,n=>n.tag==='h2'&&cls(n,'career__form-title')&&doc.text(n)==='Apply Now').length===1,applicationVisited:false},
 }
}
const boundedInteger=(value,fallback,maximum,label)=>{value=value??fallback;valid(Number.isSafeInteger(value)&&value>0&&value<=maximum,'invalid '+label);return value}

export const runAi21NativeInventory=async(options={})=>{
 options.signal?.throwIfAborted()
 const sourceTimeoutMs=boundedInteger(options.sourceTimeoutMs??options.collectionTimeoutMs,90000,180000,'source deadline'),
  requestTimeoutMs=boundedInteger(options.requestTimeoutMs,15000,30000,'request deadline'),
  maxRequests=boundedInteger(options.maxRequests,48,128,'request budget'),maxDetails=boundedInteger(options.maxDetails,20,80,'detail budget')
 const controller=new AbortController(),timeoutReason=gap('source deadline exceeded'),timer=setTimeout(()=>controller.abort(timeoutReason),sourceTimeoutMs),
  signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,responses=[],reasons=new Set()
 const audit={source:SOURCE,configuredSource:CAREERS_URL,nativeObservations:[],responses,companyGlobalTotal:null,companyIndiaTotal:null,
  sourceScopeComplete:false,sourceCompanyWideScopeComplete:false,indiaScopeComplete:false,lifecycleCleanupAllowed:false,
  nativeInventoryComplete:false,sourceFreshnessRenewed:false,returnedIndiaJobs:0}
 const now=()=>{const value=options.now?options.now():new Date().toISOString();valid(Number.isFinite(Date.parse(value)),'invalid observation clock');return new Date(value).toISOString()}
 let totalBytes=0
 const read=async url=>{
  signal.throwIfAborted();valid(responses.length<maxRequests,'request budget exhausted')
  const receipt={requestedURL:url,requestedAt:new Date().toISOString(),status:null};responses.push(receipt)
  const requestController=new AbortController(),requestReason=Object.assign(Error('AI21 native request deadline exceeded'),{failureKind:'network_or_timeout',softFailure:true,upstreamOutage:true,abortRetries:true}),
   requestTimer=setTimeout(()=>requestController.abort(requestReason),requestTimeoutMs),requestSignal=AbortSignal.any([signal,requestController.signal])
  try{
   const init={method:'GET',redirect:'manual',credentials:'omit',signal:requestSignal,headers:{Accept:'text/html'}}
   let page,rawBytes,byteProvenance
   if(options.fetchPage&&!options.fetchImpl){
    page=await readNativeWithSignal(()=>options.fetchPage(url,init),requestSignal)
    page={...page,body:page?.body??page?.html,headers:page?.headers??{},sourceCapture:page?.sourceCapture??{
     sourceRequestedAt:page?.sourceRequestedAt,sourceCompletedAt:page?.sourceCompletedAt,bodyUnavailable:page?.bodyUnavailable,
    }}
    if(typeof page.bodyBase64==='string'){rawBytes=Buffer.from(page.bodyBase64,'base64');byteProvenance='provided-original-bodyBase64'}
   }else{
    const response=await readNativeWithSignal(()=>(options.fetchImpl||globalThis.fetch)(url,init),requestSignal)
    page={status:response.status,url:response.url,contentType:response.headers.get('content-type'),headers:Object.fromEntries(response.headers),sourceCapture:response.sourceCapture}
    Object.assign(receipt,{status:page.status,finalURL:page.url,contentType:page.contentType,headers:page.headers,
     bodyUnavailable:page.sourceCapture?.bodyUnavailable===true||response.body===null,
     sourceRequestedAt:page.sourceCapture?.sourceRequestedAt??null,sourceCompletedAt:page.sourceCapture?.sourceCompletedAt??null})
    if(receipt.bodyUnavailable){
     if(page.status!==200){const error=Object.assign(Error('AI21 native HTTP '+page.status),{status:page.status});Object.assign(error,classifyScraperError(error),{abortRetries:true,lifecycleCleanupAllowed:false});throw error}
     throw gap('original native response body unavailable')
    }
    const reader=response.body?.getReader(),chunks=[];let bytes=0
    valid(reader,'missing native response body')
    try{while(true){const part=await readNativeWithSignal(()=>reader.read(),requestSignal);if(part.done)break;bytes+=part.value.byteLength;valid(bytes<=4*1024*1024,'response byte bound exceeded');chunks.push(Buffer.from(part.value))}}
    finally{Promise.resolve(reader.cancel()).catch(()=>{});reader.releaseLock()}
    rawBytes=Buffer.concat(chunks);byteProvenance='original-response-stream'
    page.body=new TextDecoder('utf-8',{fatal:true}).decode(rawBytes)
   }
   signal.throwIfAborted()
   Object.assign(receipt,{status:page.status,finalURL:page.url,contentType:page.contentType,headers:page.headers,
    sourceRequestedAt:page.sourceCapture?.sourceRequestedAt??null,sourceCompletedAt:page.sourceCapture?.sourceCompletedAt??null,
    bodyUnavailable:page.sourceCapture?.bodyUnavailable===true})
   if(receipt.bodyUnavailable&&Number.isInteger(page.status)&&page.status!==200){
    const error=Object.assign(Error('AI21 native HTTP '+page.status),{status:page.status})
    Object.assign(error,classifyScraperError(error),{abortRetries:true,lifecycleCleanupAllowed:false});throw error
   }
   valid(!receipt.bodyUnavailable,'original native response body unavailable')
   valid(typeof page.body==='string'&&Buffer.byteLength(page.body)<=4*1024*1024,'native response body unavailable or oversized')
   if(rawBytes)valid(rawBytes.length<=4*1024*1024&&new TextDecoder('utf-8',{fatal:true}).decode(rawBytes)===page.body,'original/decoded native bytes disagree')
   const bytes=rawBytes?.length??Buffer.byteLength(page.body);totalBytes+=bytes;valid(totalBytes<=24*1024*1024,'aggregate response byte bound exceeded')
   Object.assign(receipt,{status:page.status,finalURL:page.url,contentType:page.contentType,headers:page.headers,
    completedAt:new Date().toISOString(),bodyBytes:rawBytes?.length??null,bodySHA256:rawBytes?sha(rawBytes):null,
    byteProvenance:byteProvenance??'decoded-text-only',decodedBodyBytes:Buffer.byteLength(page.body),decodedBodySHA256:sha(page.body),
    sourceRequestedAt:page.sourceCapture?.sourceRequestedAt??null,sourceCompletedAt:page.sourceCapture?.sourceCompletedAt??null,
    originalCaptureSHA256:page.sourceCapture?.bodySHA256??null})
   valid(Number.isInteger(page.status),'native original HTTP status unavailable')
   if(page.status!==200){const error=Object.assign(Error('AI21 native HTTP '+page.status),{status:page.status});Object.assign(error,classifyScraperError(error),{abortRetries:true,lifecycleCleanupAllowed:false});throw error}
   valid(page.url===url,'native response redirected')
   valid(/^text\/html\b/i.test(page.contentType||''),'native response content type changed')
   return page.body
  }finally{clearTimeout(requestTimer)}
 }
 try{
  audit.observedAt=now()
  const html=await read(CAREERS_URL),rows=listAt(documentAt(html,CAREERS_URL))
  audit.nativeObservations=rows
  for(const[index,row]of rows.entries()){
   signal.throwIfAborted()
   if(!row.nativeCardVisible){reasons.add('native-card-visibility-unqualified');continue}
   if(index>=maxDetails||responses.length>=maxRequests){reasons.add('native-detail-budget-exhausted');continue}
   try{rows[index]=detailAt(await read(row.url),row)}catch(error){
    signal.throwIfAborted();options.signal?.throwIfAborted()
    const classification=classifyScraperError(error)
    row.detailError={message:error.status?'AI21 native HTTP '+error.status:error.failureKind==='coverage_gap'?error.message:'Native detail transport unavailable',status:error.status??null,...classification}
    reasons.add('native-detail-unavailable-or-unqualified')
    if(classification.failureKind==='blocked_or_access_denied')break
   }
  }
  // These documents label a city only. No country or eligibility may be inferred
  // from that city, the company domain, narrative company origin, or embed data.
  reasons.add('native-explicit-country-unavailable');reasons.add('company-and-india-scope-unverified')
  const jobs=[]
  audit.reasons=[...reasons]
  const evidence={status:'discovery-only',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:responses.length,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:audit.observedAt,reason:'ai21-native-role-observations;country-and-source-scope-unverified;cleanup-forbidden'}
  audit.inventoryEvidence=evidence
  if(options.onAudit)await readNativeWithSignal(()=>options.onAudit(structuredClone(audit)),signal)
  Object.defineProperty(jobs,'sourceAudit',{value:audit})
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.filter(row=>row.nativeCardVisible).length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return attachInventoryEvidence(jobs,evidence)
 }catch(error){
  options.signal?.throwIfAborted();if(signal.aborted)error=signal.reason
  if(error&&typeof error==='object'&&Object.isExtensible(error)){error.nativeEvidence=audit;error.lifecycleCleanupAllowed=false}
  throw error
 }finally{clearTimeout(timer)}
}
