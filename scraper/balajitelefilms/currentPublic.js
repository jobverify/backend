import {createHash} from 'node:crypto'
import {withCallerSignal,possibleVacancyMarkup} from '../abmknowledgeware/publicIntake.js'
import {parseRetryAfterHeader} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

// Source-owned, bounded reader for these four reviewed public surfaces only.
const reviewed=new Set(['balajitelefilms','amberenterprises','avglogistics','bharatforge'])
const hash=value=>createHash('sha256').update(value).digest('hex')
const header=(headers,key)=>typeof headers?.get==='function'?headers.get(key):Object.entries(headers||{}).find(([name])=>name.toLowerCase()===key)?.[1]??null
export const publicDocument=html=>readNativeDocument(html)
export const publicText=doc=>doc.text(doc.nodes(node=>node.tag==='root')[0])
export const publicTitles=doc=>doc.nodes(node=>node.tag==='title').map(node=>node.raw||'')
export const activeLinks=(doc,base)=>doc.nodes(node=>node.tag==='a'&&!node.inert&&node.attrs.href).flatMap(node=>{try{return[{url:new URL(node.attrs.href,base).href,label:doc.text(node)}]}catch{return[]}})

export function createReviewedPublicSurface(config){
 if(!reviewed.has(config.source))throw Error('Unreviewed public source')
 return{async run(options={}){
  const caller=options.signal,budget=options.collectionTimeoutMs??options.timeoutMs??120000,requestBudget=options.requestTimeoutMs??20000
  if(!Number.isSafeInteger(budget)||budget<1||budget>600000||!Number.isSafeInteger(requestBudget)||requestBudget<1||requestBudget>30000)throw TypeError('Invalid current public source bound')
  caller?.throwIfAborted()
  const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(new DOMException(config.source+' public collection deadline exceeded','TimeoutError')),budget),signals=[caller,deadline.signal],responses=[],denied=new Map(),allowed=new Set([config.url])
  let byteCount=0,opening=null,closing=null
  const gap=reason=>({status:'coverage-gap',surface:config.url,firstParty:Boolean(opening),listingComplete:false,pagesFetched:responses.filter(row=>row.status===200).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})
  const unavailable=(reason,status=null)=>Object.assign(Error(config.source+' '+reason),{source:config.source,status,abortRetries:true,softFailure:true,upstreamOutage:[401,403,429].includes(status),failureKind:[401,403,429].includes(status)?'blocked_or_access_denied':'source_inventory_unavailable',inventoryEvidence:gap(reason)})
  const read=async url=>{
   if(!allowed.has(url))throw unavailable('unreviewed public route')
   const host=new URL(url).hostname;if(denied.has(host))throw denied.get(host)
   if(responses.length>=12)throw unavailable('public request budget exceeded')
   const clock=new AbortController(),requestTimer=setTimeout(()=>clock.abort(new DOMException(config.source+' public request deadline exceeded','TimeoutError')),requestBudget),requestSignals=[...signals,clock.signal],signal=AbortSignal.any(requestSignals.filter(Boolean)),receipt={url,requestedAt:new Date().toISOString(),status:null};responses.push(receipt)
   const denial=(status,headers)=>{const error=unavailable('declared public source denied HTTP '+status,status),retryDelayMs=parseRetryAfterHeader(header(headers,'retry-after'));if(retryDelayMs!=null)error.retryDelayMs=retryDelayMs;denied.set(host,error);return error}
   try{
    let page
    if(options.fetchPage)page=await withCallerSignal(()=>options.fetchPage(url,{method:'GET',signal:caller||signal}),requestSignals)
    else if(options.fetchText)page={status:null,url,html:await withCallerSignal(()=>options.fetchText(url,{method:'GET',signal:caller||signal}),requestSignals),callerTextWithoutHTTPIdentity:true}
    else{
     const response=await withCallerSignal(()=>(options.fetchImpl||globalThis.fetch)(url,{method:'GET',redirect:'manual',signal,headers:{Accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'}}),requestSignals)
     Object.assign(receipt,{status:response.status,finalURL:response.url||url,completedAt:new Date().toISOString()})
     if([401,403,429].includes(response.status)){try{Promise.resolve(response.body?.cancel()).catch(()=>{})}catch{}throw denial(response.status,response.headers)}
     const bytes=Buffer.from(await withCallerSignal(()=>response.arrayBuffer(),requestSignals))
     page={status:response.status,url:response.url||url,html:new TextDecoder('utf-8',{fatal:true}).decode(bytes),bytes:bytes.length,sha256:hash(bytes),headers:Object.fromEntries(response.headers)}
    }
    const html=page?.html??page?.body??page?.text
    Object.assign(receipt,{status:page?.status??null,finalURL:page?.url??null,completedAt:new Date().toISOString()})
    if([401,403,429].includes(page?.status))throw denial(page.status,page.headers)
    if(typeof html!=='string'||page?.url!==url||!page.callerTextWithoutHTTPIdentity&&!Number.isInteger(page.status))throw unavailable('public response identity unavailable',page?.status)
    receipt.bytes=page.bytes??Buffer.byteLength(html);receipt.sha256=page.sha256??hash(html);byteCount+=receipt.bytes
    if(receipt.bytes>4*1024*1024||byteCount>16*1024*1024)throw unavailable('public response byte bound exceeded')
    if(page.status!==200&&!page.callerTextWithoutHTTPIdentity)throw unavailable('declared public surface unavailable HTTP '+page.status,page.status)
    return{html,status:page.status,url,pageIdentityQualified:!page.callerTextWithoutHTTPIdentity}
   }catch(error){
    if(caller?.aborted)throw caller.reason
    if(deadline.signal.aborted)throw deadline.signal.reason
    if(Number.isInteger(error?.status)&&[401,403,429].includes(error.status)){
     receipt.status=error.status;receipt.completedAt=new Date().toISOString()
     const current=Object.isExtensible(error)?error:unavailable('declared public source denied HTTP '+error.status,error.status)
     Object.assign(current,{source:config.source,abortRetries:true,softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied',inventoryEvidence:gap('declared public source denied HTTP '+error.status)})
     if(Number.isFinite(error.retryDelayMs)&&error.retryDelayMs>=0)current.retryDelayMs=error.retryDelayMs
     denied.set(host,current);throw current
    }
    throw error
   }
   finally{clearTimeout(requestTimer)}
  }
  const audit=async extra=>{
   if(options.onAudit)await withCallerSignal(()=>options.onAudit(structuredClone({source:config.source,...opening,...extra,responses,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,productionWrites:false})),signals)
  }
  try{
   const first=await read(config.url);opening=config.inspect(first.html,unavailable,{status:first.status})
   const discoveries=possibleVacancyMarkup(first.html,config.url)
   for(const link of opening.activeNativeHandoffs||[])allowed.add(link.url)
   if((opening.activeNativeHandoffs||[]).length){
    for(const link of opening.activeNativeHandoffs){try{await read(link.url)}catch(error){if(caller?.aborted||deadline.signal.aborted)throw error;await audit({inventoryEvidence:error.inventoryEvidence||gap('native public handoff unavailable'),nativeInventoryComplete:false,nativeFailure:{status:error.status??null,retryDelayMs:error.retryDelayMs??null,failureKind:error.failureKind??null}});throw error}}
    await audit({nativeInventoryComplete:false,inventoryEvidence:gap('declared public native contract remains unreviewed')})
    throw unavailable('declared public native handoff does not yet expose a reviewed enumerable inventory')
   }
   const last=await read(config.url);closing=config.inspect(last.html,unavailable,{status:last.status})
   const closingMatches=JSON.stringify(opening.model)===JSON.stringify(closing.model),possible=[...discoveries,...possibleVacancyMarkup(last.html,config.url)],reason=possible.length?'current-public-vacancy-markup-requires-native-collector':closingMatches?'current-public-hiring-observations-without-qualified-native-vacancy-inventory':'closing-public-hiring-observation-changed',evidence=gap(reason)
   const jobs=[];attachInventoryEvidence(jobs,evidence);attachSourceObservationEvidence(jobs,{source:config.source,recordKind:'hiring-signals',observedRecordCount:opening.observations?.length??0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
   await audit({closingModel:closing.model,closingMatches,possibleVacancyMarkup:possible,nativeInventoryComplete:false,inventoryEvidence:evidence})
   if(!closingMatches||possible.length)throw unavailable(reason)
   return jobs
  }finally{clearTimeout(timer)}
 }}
}

const C='https://www.balajitelefilms.com/career-opportunity.php'
export const createCurrentBalaji=()=>createReviewedPublicSurface({source:'balajitelefilms',url:C,inspect:(html,fail,response)=>{
 const doc=publicDocument(html),text=publicText(doc),links=activeLinks(doc,C)
 if(doc.nodes(node=>['iframe','script'].includes(node.tag)&&/^\/_Incapsula_Resource\?/.test(node.attrs.src||'')).length)throw Object.assign(fail('public document is a blocked challenge shell',response?.status??null),{failureKind:'blocked_or_access_denied',upstreamOutage:true})
 if(!publicTitles(doc).some(title=>/^Balaji Telefilms(?: Limited : Television, Motion Pictures)?$/i.test(title.trim()))||!text.includes('For a career with Balaji Telefilms Ltd.')||!text.includes('careers@balajitelefilms.com')||!links.some(link=>link.url===C))throw fail('current official careers employer/email binding changed')
 const activeNativeHandoffs=links.filter(link=>/current openings/i.test(link.label))
 if(activeNativeHandoffs.length)throw fail('current public native handoff is unreviewed')
 const observation={kind:'general-resume-email',url:C,email:'careers@balajitelefilms.com',vacancy:false,country:null,postingDate:null,descriptionComplete:false,applicationActionPerformed:false},model={email:observation.email,activeNativeHandoffs}
 return{model,observations:[observation],activeNativeHandoffs,commentedOpeningsAreActive:false}
}})
