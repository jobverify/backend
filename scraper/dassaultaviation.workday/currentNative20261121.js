import {setTimeout as delay} from 'node:timers/promises'
import {createHash} from 'node:crypto'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createDassaultAviationIndiaScraper,FIRST_PARTY_ROOT_URL} from '../dassaultaviationindia/script.js'
import {ATS_ORIGIN,HANDOFF_URL,ENTRY_URL,LISTING_URL} from '../dassaultaviationindia/native.js'

const SOURCE='dassaultaviation',redirects=new Set([301,302,303,307,308])
const sha=body=>createHash('sha256').update(body).digest('hex')
const fail=message=>Object.assign(Error('Dassault Aviation current native: '+message),{source:SOURCE,softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(condition,message)=>{if(!condition)throw fail(message)}
const headersForAudit=headers=>Object.fromEntries(Object.entries(headers).map(([key,value])=>[key,/^(?:set-cookie|cookie|authorization|proxy-authorization|x-(?:csrf|xsrf|auth)-token)$/i.test(key)?'[omitted]':value]))
function allowed(value){
 let u;try{u=new URL(value)}catch{return false}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false
 if([FIRST_PARTY_ROOT_URL,HANDOFF_URL,ENTRY_URL,LISTING_URL].includes(u.href))return true
 if(u.origin!==ATS_ORIGIN)return false
 if(/^\/offre-de-emploi\/emploi-[a-z0-9-]+_\d+\.aspx$/.test(u.pathname))return!u.search
 return u.pathname==='/offre-de-emploi/liste-toutes-offres.aspx'
  &&/^[1-9]\d*$/.test(u.searchParams.get('page')??'')&&Number(u.searchParams.get('page'))<=100
  &&u.searchParams.get('LCID')==='1036'&&[...u.searchParams.keys()].every(k=>['page','LCID'].includes(k))
}

// Code reuse is restricted to the identical employer/native tenant. The other
// source's captured jobs, assessments and counts are never runtime inputs.
export async function runCurrentDassault(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchPage&&!options.fetchText&&!options.fetchJson&&!options.fetchDocument,'Original HTTP Response transport is required')
 const interval=options.requestIntervalMs??500,timeoutMs=options.sourceTimeoutMs??options.timeoutMs??180000,requestTimeoutMs=options.requestTimeoutMs??15000,maxRequests=options.maxNativeRequests??96
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=500||options.fetchImpl),'Invalid native request pacing')
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=240000,'Invalid native source deadline')
 need(Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=15000,'Invalid native request deadline')
 need(Number.isSafeInteger(maxRequests)&&maxRequests>0&&maxRequests<=192,'Invalid native request ceiling')
 const fetchImpl=options.fetchImpl??globalThis.fetch,receipts=[],deniedHosts=new Set(),last=new Map()
 let aggregate=0
 const transport=async(url,init={})=>{
  options.signal?.throwIfAborted()
  need(allowed(url)&&(init.method??'GET')==='GET'&&init.body===undefined,'Undeclared or non-GET native request refused')
  need(receipts.length<maxRequests,'Bounded native acquisition stopped; remaining observations uninspected')
  const host=new URL(url).hostname;need(!deniedHosts.has(host),'Publisher host denied; no subsequent request')
  const signal=init.signal,wait=interval-(performance.now()-(last.get(host)??-Infinity))
  if(wait>0)await delay(wait,undefined,{signal})
  options.signal?.throwIfAborted();signal?.throwIfAborted();last.set(host,performance.now())
  const receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),bodyComplete:false};receipts.push(receipt)
  try{
   const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs:requestTimeoutMs,request:{method:'GET'},overflowError:fail('Native transport entity exceeds16MiB'),
    fetchImpl:async(requested,request)=>{
     const raw=await fetchImpl(requested,{...request,credentials:'omit'})
     options.signal?.throwIfAborted()
     const headers=Object.fromEntries(raw.headers)
     Object.assign(receipt,{status:raw.status,finalURL:raw.url,headers:headersForAudit(headers)})
     try{
      if(redirects.has(raw.status)){
       need(typeof headers.location==='string'&&headers.location.length>0,'Native redirect lacks a declared destination')
       const location=new URL(headers.location,requested).href
       need([HANDOFF_URL,ENTRY_URL].includes(requested)&&[HANDOFF_URL,ENTRY_URL].includes(location),'Native handoff redirected outside its exact declared tenant')
       receipt.location=location;receipt.redirectBodyIntentionallyNotRead=true
       try{void raw.body?.cancel().catch(()=>{})}catch{/* Preserve admission reason. */}
       return{status:raw.status,url:raw.url,headers:raw.headers,body:null}
      }
      if([401,403,429,451].includes(raw.status))deniedHosts.add(host)
      const expected=requested===HANDOFF_URL&&raw.url===ENTRY_URL?ENTRY_URL:requested
      await requireNativeHttpResponse({status:raw.status,url:raw.url,headers,body:null},expected,{context:'Dassault current native public read',signal:request.signal,callerSignal:options.signal??null})
      need(/^text\/html(?:;|$)/i.test(headers['content-type']??''),'Native page MIME is not HTML')
      need(!headers['content-length']||Number(headers['content-length'])<=3*1024*1024,'Native content length exceeds parser ceiling')
      return raw
     }catch(error){try{void raw.body?.cancel(error).catch(()=>{})}catch{/* Preserve primary error. */}throw error}
    }})
   options.signal?.throwIfAborted();signal?.throwIfAborted()
   const bytes=Buffer.from(page.bodyBase64,'base64')
   aggregate+=bytes.length
   Object.assign(receipt,{bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64,bodyComplete:!redirects.has(page.status)})
   need(bytes.length<=3*1024*1024&&aggregate<=32*1024*1024,'Native parser/aggregate decoded byte ceiling exceeded')
   need(Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes),'Native entity is not valid UTF-8')
   const body=bytes.toString('utf8')
   if(/<title[^>]*>\s*(?:Just a moment|Access Denied|Forbidden|Security Verification|Robot Check)/i.test(body)){
    deniedHosts.add(host);throw Object.assign(fail('Publisher access challenge; no further requests'),{failureKind:'blocked_or_access_denied'})
   }
   const response=new Response(redirects.has(page.status)?null:bytes,{status:page.status,headers:page.headers})
   Object.defineProperty(response,'url',{value:page.url});return response
  }finally{receipt.completedAt=new Date().toISOString()}
 }
 try{
  const acquired=await createDassaultAviationIndiaScraper().run({...options,fetchImpl:transport,timeoutMs})
  options.signal?.throwIfAborted()
  const original=acquired.nativeCollectionEvidence??{},jobs=acquired.map(job=>({...job,source:SOURCE,company:'Dassault Aviation'}))
  const evidence={...original,source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:original.nativePublicJobCount??null,observedVacancyCount:original.nativePublicJobCount??null,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,sharedSameEmployerParser:'dassaultaviationindia/native.js',sharedParserOutputReacquiredByThisSource:true,otherSourceAssessmentOrJobsUsed:false,nativeTransportReceipts:receipts,decodedBytes:aggregate,requestIntervalMs:interval,applicationInteractions:0,applicationSubmissions:0,renderedApplicationQualified:false}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence})
  attachSourceObservationEvidence(jobs,evidence)
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LISTING_URL,firstParty:true,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:'Fresh same-employer native Talentsoft collection; independently qualified own India roles with full per-role closing; remaining observations and company-wide scope remain unqualified.'})
  options.signal?.throwIfAborted();return jobs
 }catch(error){
  options.signal?.throwIfAborted()
  const wrapped=fail('Current native acquisition unavailable: '+(error?.message??'unknown error'));wrapped.cause=error
  // The shared collector supplies context through causes; retain the original
  // native HTTP classification rather than replacing a denial with coverage.
  const chain=[],seen=new Set()
  for(let cause=error;cause&&typeof cause==='object'&&!seen.has(cause)&&chain.length<12;cause=cause.cause){seen.add(cause);chain.push(cause)}
  const typed=chain.find(cause=>cause.failureKind==='blocked_or_access_denied')??chain.find(cause=>cause.failureKind&&cause.failureKind!=='coverage_gap')
  if(typed)for(const field of ['failureKind','status','httpStatus','statusCode','upstreamOutage','softFailure','abortRetries','stage'])if(Object.hasOwn(typed,field))wrapped[field]=typed[field]
  const denied=receipts.find(receipt=>[401,403,429,451].includes(receipt.status))
  if(denied)Object.assign(wrapped,{failureKind:'blocked_or_access_denied',status:denied.status,httpStatus:denied.status,statusCode:denied.status,abortRetries:true})
  Object.defineProperty(wrapped,'nativeCollectionEvidence',{value:{source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,retainedResponses:error?.retainedResponses??[],nativeTransportReceipts:receipts,deniedPublisherHosts:[...deniedHosts],decodedBytes:aggregate}})
  throw wrapped
 }
}
