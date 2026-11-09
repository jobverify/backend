import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { attachInventoryEvidence, readInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import {settingsFor,runtime,bounded,failure,annotateFailure} from './runtime20261107.js'
import {nativeTransport,MAX_BYTES} from './transport20261107.js'
import { runWaymoNative } from './native.js'
import { nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'waymo'
export const COMPANY = 'Waymo'
export const FIRST_PARTY_ROOT_URL = 'https://careers.withwaymo.com/jobs/search'
export const INDIA_COUNTRY_CODE = 'IN'

export const buildIndiaSearchUrl = () => {
  const url = new URL(FIRST_PARTY_ROOT_URL)
  url.searchParams.append('country_codes[]', INDIA_COUNTRY_CODE)
  return url.toString()
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toAbsoluteUrl = (value, baseUrl = FIRST_PARTY_ROOT_URL) => {
  try {
    const url = new URL(value, baseUrl)
    return url.origin === new URL(FIRST_PARTY_ROOT_URL).origin && /^\/jobs\/[a-z0-9-]+$/.test(url.pathname)
      && url.pathname !== '/jobs/search' && !url.search && !url.hash && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

const extractArticleBlocks = (html) =>
  Array.from(String(html ?? '').matchAll(
    /<article\b[^>]*\bjob-search-results-card-col\b[\s\S]*?<\/article>/gi,
  ), (match) => match[0])

const extractComponentText = (html, componentClass) => stripTags(
  String(html ?? '').match(
    new RegExp(`<li[^>]+class=["'][^"']*${componentClass}[^"']*["'][\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>`, 'i'),
  )?.[1],
)

const extractSummary = (html) => stripTags(
  String(html ?? '').match(
    /<p[^>]+class=["'][^"']*job-search-results-summary[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
  )?.[1],
)

const extractDisplayedCount = (html) => {
  const candidates = [
    String(html ?? '').match(/Displaying\s*<b>\s*all(?:&nbsp;|\s)+(\d+)\s*<\/b>\s*entries/i)?.[1],
    String(html ?? '').match(/\bdata-filter=["']country_code["'][^>]*\bdata-value=["']india["'][^>]*\bdata-count=["'](\d+)["']/i)?.[1],
  ]

  for (const candidate of candidates) {
    const count = Number.parseInt(candidate, 10)
    if (Number.isInteger(count) && count >= 0) return count
  }

  return null
}

const extractJobId = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

// Listing cards are observations. Only the registered native detail reader
// establishes explicit country, a requisition, full description and application.
export const extractJobsFromSearchHtml = (html, {
  scrapedAt = new Date().toISOString(),
} = {}) => extractArticleBlocks(html)
  .map((article) => {
    const titleLink = article.match(
      /<a\b(?=[^>]*\bid=["']link_job_title_[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/i,
    )
    const sourceUrl = toAbsoluteUrl(titleLink?.[1])
    const title = stripTags(titleLink?.[2])
    const location = extractComponentText(article, 'job-component-location')
    const city = normalizeCity(String(location ?? '').split(',')[0]) || String(location ?? '').split(',')[0]?.trim() || null
    const jobId = extractJobId(sourceUrl)

    if (!sourceUrl || !title || !location || !jobId) return null

    return {
      jobId,
      title,
      company: COMPANY,
      department: extractComponentText(article, 'job-component-department'),
      location,
      city,
      country: nativeLocationCountryName(location),
      sourceUrl,
      applyUrl: null,
      employmentType: extractComponentText(article, 'job-component-employment-type'),
      experienceRequired: extractComponentText(article, 'job-component-dropdown-field-2'),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      nativeListingSummary: extractSummary(article),
      sourceDetailComplete: false,
      sourceDetailStatus: 'listing-summary-only',
      sourceListingComplete: false,
      requisitionId: null,
      source: SOURCE,
      link: sourceUrl,
      scrapedAt,
    }
  })
  .filter(Boolean)

const errorValue=(error,key)=>{for(let item=error,depth=0;item&&typeof item==='object'&&depth<5;item=Object.getPrototypeOf(item),depth++){const field=Object.getOwnPropertyDescriptor(item,key);if(field)return field.value}}
const safeFailure=error=>({name:errorValue(error,'name')??null,code:errorValue(error,'code')??null,message:typeof errorValue(error,'message')==='string'?errorValue(error,'message').slice(0,500):typeof error==='string'?error.slice(0,500):null})
export const createWaymoScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options),control=runtime(settings),receipts=[],attempts=[]
 let result,audit,firstError,failureObserved=false,latest={partialNativeJobs:[],nativeCollectionEvidence:null,firstParty:false,verifiedAt:null}
 const evidence=reason=>normalizeInventoryEvidence({status:'coverage-gap',surface:buildIndiaSearchUrl(),firstParty:latest.firstParty,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:latest.firstParty?latest.verifiedAt:null,reason})
 const read=async(url,init={})=>{
  const {onAdmitted,...requestInit}=init
  control.admit();attempts.push({url,method:'GET',redirect:'manual',credentials:'omit'});onAdmitted?.();let receipt
  const retain=value=>{
   if(!value||typeof value!=='object')return
   if(!receipt){receipt={url,response:null};receipts.push(receipt)}
   const bytes=typeof value.body==='string'?Buffer.byteLength(value.body):null,oversized=bytes!==null&&bytes>MAX_BYTES
   const prefix=oversized?Buffer.from(value.body).subarray(0,MAX_BYTES):null
   receipt.response={...value,headers:value.headers?{...value.headers}:value.headers,body:oversized?null:value.body,bodyComplete:oversized?false:value.bodyComplete??typeof value.body==='string',receivedBodyBytes:bytes===null?value.receivedBodyBytes??null:Math.max(bytes,value.receivedBodyBytes??0),bodyBytes:oversized?prefix.length:value.bodyBytes??bytes,rawBodyBase64:oversized?prefix.toString('base64'):value.rawBodyBase64??null,...(oversized?{bodyTruncated:true,bodyUnavailableReason:'Returned entity exceeds4000000 byte bound'}:{})}
   return receipt.response
  }
  const load=settings.fetchText??nativeTransport({timeoutMs:settings.readTimeoutMs,onReceipt:retain})
  return control.read(async signal=>{
   const value=await load(url,{...requestInit,method:'GET',redirect:'manual',credentials:'omit',signal})
   if(typeof value==='string'){retain({body:value,status:null,url:null,contentType:null,headers:null,transport:'injected-text',metadataUnavailableReason:'Text-only callback supplied no HTTP metadata'});if(Buffer.byteLength(value)>MAX_BYTES)throw failure('Waymo native document exceeds4000000 bytes','WAYMO_BODY_LIMIT');return value}
   const snapshot=retain(value);if(settings.fetchText)throw failure('Waymo text callback returned a non-text response','WAYMO_TRANSPORT_CONTRACT');if(typeof snapshot?.body!=='string')throw failure('Waymo original text unavailable','WAYMO_BODY_UNAVAILABLE');return snapshot.body
  })
 }
 try{
  if(settings.maxJobs===0||settings.maxPages===0)result=attachInventoryEvidence([],evidence('caller-zero-cap-no-source-observation'))
  else result=await runWaymoNative({read,searchUrl:buildIndiaSearchUrl(),now:()=>{control.check();const value=(settings.now??(()=>new Date().toISOString()))();control.check();return value},signal:control.signal,maxJobs:settings.maxJobs,onEvidence:value=>{latest=structuredClone(value)}})
  control.check()
  if(result.nativeCollectionEvidence){Object.assign(result.nativeCollectionEvidence,{retainedNativeResponses:receipts,attempts});if(result[0]?.sourceNativeCollectionAudit)Object.assign(result[0].sourceNativeCollectionAudit,{retainedNativeResponses:receipts,attempts})}
 }catch(error){firstError=error;failureObserved=true}
 try{
  settings.signal?.throwIfAborted()
  const collection=result?.nativeCollectionEvidence??latest.nativeCollectionEvidence,interruption=collection?.incompleteCollectionFailure
  audit={source:'waymo',status:failureObserved||interruption?'partial':settings.maxJobs===0||settings.maxPages===0?'skipped':'native-output',retainedNativeResponses:receipts,attempts,partialNativeJobs:latest.partialNativeJobs,nativeCollectionEvidence:collection,sourceScopeComplete:false,cleanupAllowed:false,requestCount:control.requests,gaps:failureObserved?[safeFailure(firstError)]:interruption?[{...interruption,message:interruption.reason}]:[]}
  if(settings.onAudit)try{await bounded(()=>settings.onAudit(structuredClone(audit)),{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'WAYMO_AUDIT_TIMEOUT'});control.check()}catch(error){settings.signal?.throwIfAborted();if(failureObserved)audit.auditSinkFailure=safeFailure(error);else{firstError=error;failureObserved=true}}
  if(failureObserved){
   const primaryStatus=errorValue(firstError,'status'),returnedStatus=receipts.at(-1)?.response.status,status=primaryStatus===undefined&&Number.isInteger(returnedStatus)&&returnedStatus!==200?returnedStatus:primaryStatus
   const patch={source:SOURCE,abortRetries:true,sourceScopeComplete:false,sourceListingComplete:false,retainedNativeResponses:receipts,partialNativeJobs:latest.partialNativeJobs,nativeEvidence:audit,inventoryEvidence:evidence('first-native-failure;company-inventory-unresolved'),...(status!==undefined?{status}:{})}
   if([202,401,403,429,451].includes(status))Object.assign(patch,{failureKind:status===202?'upstream_unavailable':'blocked_or_access_denied',softFailure:true,upstreamOutage:true})
   const error=annotateFailure(firstError,patch)
   throw error
  }
  return attachInventoryEvidence(result,{...readInventoryEvidence(result),pagesFetched:receipts.length})
 }finally{control.close()}
}})

export const run = async (options = {}) => createWaymoScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/waymo/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
