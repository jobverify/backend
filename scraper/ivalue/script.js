import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { IVALUE_CATALOG } from './catalog.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {validateCompany,validateBoard,validateIValueFeed,validateIValueDetail} from './nativeContract.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = IVALUE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEGACY_OFFICIAL_CAREERS_URL = PROVIDER_METADATA.legacyCareerPageUrl
export const JOBS_PAGE_URL = PROVIDER_METADATA.verifiedPublicJobsPageUrl
export const COMPANY_DETAILS_URL = PROVIDER_METADATA.companyDetailsUrl
export const EMPLOYMENT_CATEGORIES_URL = PROVIDER_METADATA.employmentCategoriesUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
const SOURCE_DIAGNOSTICS=Symbol('ivalue-native-diagnostics')
export const readIValueSourceDiagnostics=jobs=>jobs?.[SOURCE_DIAGNOSTICS]||null
// The native client also advertises a separate hiring-event inventory. This
// source has not reconciled that scope, so this board cannot prove company-wide
// completeness or an empty employer even when its own full feed is stable.
const COMPANY_SCOPE_COMPLETE=false

const FOREIGN_LOCATION_NAMES = new Set([
  'Singapore',
  'Bangladesh',
  'Cambodia',
  'Srilanka',
  'Nepal',
  'Kenya',
  'Dubai',
  'UAE',
  'Vietnam',
  'Philippines',
  'Thailand',
])

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&#8211;|&#8212;|&#x2013;|&#x2014;|&ndash;|&mdash;/gi, '-')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsPreservingLines = (value) =>
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

const stripTags = (value) => normalizeWhitespace(stripTagsPreservingLines(value))

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchText = async (url,{signal}={}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: signal || createTimeoutSignal(20000),
  })

  if (response.status!==200 || response.url!==url) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const method = options.method || 'GET'
  const body = method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined
  const response = await fetch(url, {
    method,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body,
    redirect: 'follow',
    signal: options.signal || createTimeoutSignal(20000),
  })

  if (response.status!==200 || response.url!==url) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const monthsToYearsLabel = (months) => {
  if (!Number.isFinite(months) || months <= 0) return null

  const years = months / 12
  const rounded = Number.isInteger(years) ? years.toString() : years.toFixed(1).replace(/\.0$/, '')
  return `${rounded} years`
}

const extractExperienceRequired = (job) => {
  const min = Number(job?.min_exp)
  const max = Number(job?.max_exp)

  if ((!Number.isFinite(min) || min <= 0) && (!Number.isFinite(max) || max <= 0)) {
    return null
  }

  const minLabel = monthsToYearsLabel(min)
  const maxLabel = monthsToYearsLabel(max)

  if (minLabel && maxLabel) {
    return `${minLabel.replace(' years', '')}-${maxLabel}`
  }

  return minLabel || maxLabel
}

const extractLocationFromDescription = (description) => {
  const text = stripTagsPreservingLines(description)
  const patterns = [
    /Job Location\s*:?\s*([^\n]+)/i,
    /Work Location\s*:?\s*([^\n]+)/i,
    /Location\s*:?\s*([^\n]+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    const location = normalizeWhitespace(match?.[1])
    if (location) return location.replace(/\s*\/\s*/g, ', ')
  }

  return null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const [firstSegment] = normalized.split(',')
  return normalizeWhitespace(firstSegment)
}

const isIndiaLocationName = (name) => {
  const normalized = normalizeWhitespace(name)
  return ['Mumbai','Delhi','Chennai','Bangalore','Hyderabad','Pune','New Delhi','Kolkata','Ahmedabad','Kochi','Telangana','Kerala','Coimbatore','Jaipur','Bhopal','Nashik','Lucknow'].includes(normalized)
}

const isIndiaJob = (locationNames, description) => {
  const normalizedNames = (Array.isArray(locationNames) ? locationNames : [])
    .map((name) => normalizeWhitespace(name))
    .filter(Boolean)

  if (normalizedNames.length > 0) {
    return normalizedNames.some((name) => isIndiaLocationName(name))
  }

  const fallbackLocation = extractLocationFromDescription(description)
  if (!fallbackLocation) return false

  return isIndiaLocationName(fallbackLocation)
}

export const hasOfficialCareersBlockSignal = (html = '') => {
  const page = String(html ?? '')

  return /noindex,\s*nofollow/i.test(page)
    && /_Incapsula_Resource/i.test(page)
    && /Incapsula/i.test(page)
}

export const hasPublicJobsPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at iValue Group\s*<\/title>/i.test(page)
    && /property=["']og:url["'][^>]*content=["']https:\/\/ivgroup\.greythr\.com\/hire\/jobs\/?["']/i.test(page)
    && /careerbuild(?:\.[a-f0-9]+)?\.js/i.test(page)
}

export const hasCompanyDetailsSignal = (payload = {}) => {
  try{return validateCompany(payload)}catch{return false}
}

export const buildLocationLookup = (payload = {}) => {
  const locationCategoryId = normalizeWhitespace(payload?.cat_extfield?.location)
  const values = payload?.value

  if (!locationCategoryId || !values || typeof values !== 'object') {
    throw new Error('iValue verified GreytHR employment category catalog changed materially')
  }

  const lookup = {}

  for (const [id, value] of Object.entries(values)) {
    if (normalizeWhitespace(value?.cat_id) !== locationCategoryId) continue

    const name = normalizeWhitespace(value?.name)
    if (name) {
      lookup[id] = name
    }
  }

  if (Object.keys(lookup).length === 0) {
    throw new Error('iValue verified GreytHR employment category catalog changed materially')
  }

  return lookup
}

const mapJob = (job, locationLookup, scrapedAt) => {
  const locationNames = (Array.isArray(job?.locations) ? job.locations : [])
    .map((id) => locationLookup[String(id)])
    .map((name) => normalizeWhitespace(name))
    .filter(Boolean)

  if (!isIndiaJob(locationNames, job?.description)) {
    return null
  }

  const location = locationNames.length > 0
    ? locationNames.join(', ')
    : extractLocationFromDescription(job?.description)

  return {
    title: normalizeWhitespace(job?.title),
    company: COMPANY,
    department: null,
    location,
    city: extractCity(location),
    country: 'India',
    jobId: normalizeWhitespace(job?.id),
    requisitionId: normalizeWhitespace(job?.req_id),
    sourceUrl: normalizeWhitespace(job?.apply_url),
    applyUrl: normalizeWhitespace(job?.apply_url),
    employmentType: normalizeWhitespace(job?.job_type),
    experienceRequired: extractExperienceRequired(job),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job?.published_on_career_page || job?.created_at),
    closingDate: null,
    jobDescription: stripTags(job?.description),
    remoteStatus: job?.is_remote ? 'Remote' : 'On-site',
    source: SOURCE,
    link: normalizeWhitespace(job?.apply_url),
    scrapedAt,
  }
}

export const createIValueScraper = ({maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : 10000} = {}) => ({
 async run({fetchText=defaultFetchText,fetchJson=defaultFetchJson,fetchOfficialPage,now=()=>new Date().toISOString(),signal,detailConcurrency=2,timeoutMs=120000}={}) {
  if(!Number.isInteger(maxJobs)||maxJobs<0||maxJobs>10000||!Number.isInteger(detailConcurrency)||detailConcurrency<1||detailConcurrency>3||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw new Error('iValue invalid configured limits')
  const controller=new AbortController(),abort=()=>controller.abort(signal?.reason),timer=setTimeout(()=>controller.abort(new Error('iValue source deadline exceeded')),timeoutMs)
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true})
  const request=async(fn,url,options={})=>{controller.signal.throwIfAborted();const requestSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);let listener
   try{return await Promise.race([Promise.resolve().then(()=>fn(url,{...options,signal:requestSignal})),new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true})})])}finally{requestSignal.removeEventListener('abort',listener)}
  }
  try{
   const scrapedAt=now();if(typeof scrapedAt!=='string'||!Number.isFinite(Date.parse(scrapedAt)))throw new Error('iValue invalid check time')
   let corporateCheck='active-current-official-handoff',officialHtml
   if(fetchOfficialPage){const page=await request(fetchOfficialPage,OFFICIAL_CAREERS_URL);if(page?.status!==200||page.url!==OFFICIAL_CAREERS_URL||typeof page.html!=='string')throw new Error('iValue current browser/corporate handoff unavailable');officialHtml=page.html}
   else officialHtml=await request(fetchText,OFFICIAL_CAREERS_URL)
   const active=extractOfficialRecruitmentLinks(String(officialHtml??''),OFFICIAL_CAREERS_URL).some(l=>l.href===JOBS_PAGE_URL)
   if(!active){
    if(!hasOfficialCareersBlockSignal(officialHtml))throw new Error('iValue official handoff unavailable without verified interstitial')
    const proof=IVALUE_CATALOG.approvedCorporateBinding,age=Date.parse(scrapedAt)-Date.parse(proof?.checkedAt)
    if(proof?.officialURL!==OFFICIAL_CAREERS_URL||proof?.target!==JOBS_PAGE_URL||proof?.verified!==true||!Number.isFinite(age)||age<0||age>48*3600000)throw new Error('iValue blocked corporate check requires fresh approved binding or current fetchOfficialPage hook')
    corporateCheck='blocked-interstitial-used-fresh-approved-binding'
   }
   validateBoard(await request(fetchText,JOBS_PAGE_URL))
   validateCompany(await request(fetchJson,COMPANY_DETAILS_URL,{method:'GET'}))
   const categories=await request(fetchJson,EMPLOYMENT_CATEGORIES_URL,{method:'GET'}),feed=validateIValueFeed(await request(fetchJson,JOBS_API_URL,{method:'POST',body:{}}),categories,{now:scrapedAt})
   const indiaRows=feed.rows.filter(r=>r.scope.indiaLocations.length),limited=maxJobs<indiaRows.length,selected=limited?indiaRows.slice(0,maxJobs):feed.rows
   const grouped=new Map();for(const entry of selected){const group=grouped.get(entry.record.apply_url)||[];group.push(entry);grouped.set(entry.record.apply_url,group)}
   const groups=[...grouped.values()],results=new Array(groups.length),rejectedNativeIdentities=[];let cursor=0
   await Promise.all(Array.from({length:Math.min(detailConcurrency,groups.length)},async()=>{
    while(cursor<groups.length){controller.signal.throwIfAborted();const index=cursor++,group=groups[index],url='https://ivgroup.greythr.com/hire/api/career/get_job/'+group[0].record.slug+'/'
     const payload=await request(fetchJson,url,{method:'GET'}),matching=group.filter(r=>r.record.id===payload?.job?.id)
     if(matching.length!==1)throw new Error('iValue public detail cannot resolve native listing identity')
     const row=matching[0].record,detail=validateIValueDetail(payload,row,categories,{now:scrapedAt})
     for(const other of group.filter(r=>r.record.id!==row.id))rejectedNativeIdentities.push({nativeId:other.record.id,requisitionId:other.record.req_id,title:other.record.title,applyUrl:other.record.apply_url,resolvedNativeId:row.id,reason:'ambiguous-public-url-resolves-to-another-native-identity'})
     if(!detail.scope.indiaLocations.length){results[index]=null;continue}
     const locationLookup=Object.fromEntries(detail.scope.indiaLocations.map(p=>[p.id,p.name]))
     const mapped=mapJob({...detail.record,locations:detail.scope.indiaLocations.map(p=>p.id)},locationLookup,scrapedAt)
     if(!mapped)throw new Error('iValue validated native role failed mapping')
     results[index]={...mapped,jobDescription:detail.description,postingDate:detail.postingDate,closingDate:detail.closingDate,sourceClosingDateIsExact:detail.sourceClosingDateIsExact,sourceDetailComplete:detail.sourceDetailComplete,sourceDetailStatus:detail.sourceDetailStatus,sourceListingComplete:!limited,sourceCorporateCheck:corporateCheck,sourceNativeLocations:detail.scope.locations}
    }
   }))
   const finalCategories=await request(fetchJson,EMPLOYMENT_CATEGORIES_URL,{method:'GET'}),finalFeed=validateIValueFeed(await request(fetchJson,JOBS_API_URL,{method:'POST',body:{}}),finalCategories,{now:scrapedAt})
   if(feed.snapshot!==finalFeed.snapshot||JSON.stringify(feed.rows.map(r=>r.scope))!==JSON.stringify(finalFeed.rows.map(r=>r.scope)))throw new Error('iValue native inventory or categories changed during details')
   const jobs=results.filter(Boolean),complete=COMPANY_SCOPE_COMPLETE&&!limited&&feed.publicIdentityCollisions.length===0
   jobs.forEach(job=>{job.sourceListingComplete=complete})
   Object.defineProperty(jobs,SOURCE_DIAGNOSTICS,{value:{rawObservedRows:feed.total,rawObservedIndiaRows:indiaRows.length,uniquePublicUrls:new Set(feed.rows.map(r=>r.record.apply_url)).size,publicIdentityCollisions:feed.publicIdentityCollisions,rejectedNativeIdentities,corporateCheck,finalInventoryRechecked:true,companyHealthComplete:complete&&jobs.every(j=>j.sourceDetailComplete)}})
   return attachInventoryEvidence(jobs,{status:complete?(feed.total?'complete-inventory':'verified-empty'):!limited?'coverage-gap':'discovery-only',surface:JOBS_PAGE_URL,firstParty:true,listingComplete:complete,pagesFetched:1,reportedTotal:feed.total,indiaFacetCount:indiaRows.length,verifiedAt:now(),reason:complete?(jobs.every(j=>j.sourceDetailComplete)?'full-public-feed-native-details-and-final-snapshot':'full-public-inventory-with-incomplete-details'):feed.publicIdentityCollisions.length?'ambiguous-native-public-identity; individually-verified-subset-only':limited?'configured-cap-incomplete':'additional-public-hiring-event-scope-unverified'})
  }finally{controller.abort();clearTimeout(timer);signal?.removeEventListener('abort',abort)}
 }
})
export const run=async(options={})=>createIValueScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
