import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { AMNEAL_PHARMACEUTICALS_INDIA_CATALOG } from './catalog.js'
import {readAmnealCareersHandoff} from './nativeHandoff.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMNEAL_PHARMACEUTICALS_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const PAGINATION_STRATEGY = PROVIDER_METADATA.paginationStrategy
export const EXTRACTION_STRATEGY = PROVIDER_METADATA.extractionStrategy
export const PARSER = PROVIDER_METADATA.parser
export const NORMALIZATION_PROFILE = PROVIDER_METADATA.normalizationProfile
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const SEARCH_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CANDIDATE_EXPERIENCE_URL = PROVIDER_METADATA.oracleCandidateExperienceUrl
export const WORKSPACE_DOMAIN = PROVIDER_METADATA.workspaceDomain
export const LISTING_API_BASE_URL = PROVIDER_METADATA.listingApiBaseUrl
export const DETAIL_API_BASE_URL = PROVIDER_METADATA.detailApiBaseUrl
export const PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.publicJobsBaseUrl
export const SITE_NUMBER = PROVIDER_METADATA.siteNumber
export const DEFAULT_LOCATION = 'India'
export const DEFAULT_LIMIT = 24

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const activeNativeText = value => {
  const doc=readVisibleNativeDocument(String(value??''),{strict:true})
  const text=node=>{
    if(typeof node==='string')return node
    if(node.inert||['script','style'].includes(node.tag))return ''
    const body=node.children.map(text).join(' ')
    return /^(?:p|div|li|h[1-6]|ul|ol|br|hr)$/.test(node.tag)?'\n'+body+'\n':body
  }
  return text(doc.nodes(node=>node.tag==='root')[0])
}
const stripTagsToLines = (value) =>
  activeNativeText(value)
    .split('\n')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^india$/i.test(normalized)) return COUNTRY_FILTER
  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => normalizeWhitespace(activeNativeText(part)))
    .filter(Boolean)
    .join(' '),
)

const getRequisitionList = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
  }

  if (Array.isArray(payload?.requisitionList)) {
    return payload.requisitionList
  }

  return []
}

const getRequisitionDetail = (payload) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }

  return payload || {}
}

const getEmploymentType = (record = {}) =>
  normalizeWhitespace(
    record.JobSchedule
      || record.RequisitionType
      || record.JobType
      || record.WorkerType
      || record.ContractType,
  )

const isIndiaJob = (record = {}) => {
  const country = normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase()
  const primaryLocation = normalizeWhitespace(record.PrimaryLocation)
  return country === 'IN' && (!primaryLocation || /(?:^|,)\s*india\s*$/i.test(primaryLocation))
    || !country && /(?:^|,)\s*india\s*$/i.test(primaryLocation || '')
}

const extractQualificationDetails = (record = {}) => {
  const lines = stripTagsToLines(record.ExternalQualificationsStr)
  const experienceLine = lines.find((line) => /\byears?\b/i.test(line) || /\bexperience\b/i.test(line)) || null
  const qualificationLines = lines.filter((line) => line !== experienceLine)

  return {
    minimumQualification: normalizeWhitespace(qualificationLines.join(' ')) || normalizeWhitespace(record.StudyLevel),
    experienceRequired: normalizeWhitespace(experienceLine),
  }
}

export const hasOfficialCareersPageSignal = (html) => {
  return Boolean(readAmnealCareersHandoff(String(html??'')))
}

export const hasOfficialSearchPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Search Career Opportunities \| Amneal India\s*<\/title>/i.test(page)
    && /href=["']https:\/\/hcfa\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_5001["'][^>]*>[\s\S]{0,250}?India Career Opportunities/i.test(page)
    && text.includes('We have many ways for you to grow and contribute')
    && text.includes('Join our team and help build an exciting future.')
}

export const hasOfficialCandidateExperienceSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Amneal India\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Amneal India Careers["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Amneal India["']/i.test(page)
    && /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX_5001\/?["']/i.test(page)
    && /siteFavicon\/favicon-16x16\.png\?siteNumber=CX_5001/i.test(page)
  }

export const buildSearchUrl = ({
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
} = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit

  return `${LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${normalizedLimit},offset=${offset},location=${location}`
}

export const buildJobDetailUrl = (jobId) =>
  `${PUBLIC_JOBS_BASE_URL}${normalizeWhitespace(jobId) || ''}`

export const buildJobApplyUrl = (jobId) =>
  `${buildJobDetailUrl(jobId)}/apply`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

const toListing = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = normalizeLocation(
    record.PrimaryLocation
      || record?.secondaryLocations?.[0]?.Name,
  )

  return {
    title: normalizeWhitespace(record.Title),
    company: COMPANY_NAME,
    department: normalizeWhitespace(record.JobFunction || record.Department || record.Category || record.JobFamily),
    location,
    city: extractCity(location),
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId,
    sourceUrl: buildJobDetailUrl(jobId),
    applyUrl: buildJobApplyUrl(jobId),
    employmentType: getEmploymentType(record),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.ExternalPostedStartDate || record.PostedDate),
    closingDate: normalizeDate(record.ExternalPostedEndDate || record.PostingEndDate),
    jobDescription: joinDescriptionParts(record.ShortDescriptionStr),
    remoteStatus: null,
    siteNumber: SITE_NUMBER,
  }
}

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toListing(record))
  .filter((job) => job.title && job.jobId)

export const extractPaginationSummary = (payload, { page = 0 } = {}) => {
  const listingSummary = payload?.items?.[0] || {}
  const pageSize = Number(listingSummary.Limit) || DEFAULT_LIMIT
  const totalCount = Number(listingSummary.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

export const extractJobDetail = (payload, listing = {}) => {
  const detail = getRequisitionDetail(payload)
  if(!Array.isArray(payload?.items)||payload.items.length!==1||!listing.jobId
    ||normalizeWhitespace(detail.Id)!==listing.jobId||normalizeWhitespace(detail.Title)!==listing.title
    ||!isIndiaJob(detail)||normalizeLocation(detail.PrimaryLocation)!==listing.location){
    throw Object.assign(new Error('Amneal India native detail identity or primary workplace contradicts the advertised listing'),{abortRetries:true})
  }
  const nativeDescription=joinDescriptionParts(detail.ExternalDescriptionStr,detail.ExternalResponsibilitiesStr)
  if(!nativeDescription||nativeDescription.length<150){
    throw Object.assign(new Error('Amneal India native role description is missing or unqualified; listing teaser is not a full JD'),{
      code:'AMNEAL_NATIVE_DESCRIPTION_UNAVAILABLE',nativeJobId:listing.jobId,abortRetries:true})
  }
  const location = normalizeLocation(detail.PrimaryLocation) || listing.location || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const qualifications = extractQualificationDetails(detail)

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: COMPANY_NAME,
    department: normalizeWhitespace(detail.JobFunction || detail.Department || detail.Category || detail.JobFamily)
      || listing.department
      || null,
    location,
    city: extractCity(location) || listing.city || null,
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || buildJobDetailUrl(jobId),
    applyUrl: listing.applyUrl || buildJobApplyUrl(jobId),
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: qualifications.experienceRequired || listing.experienceRequired || null,
    minimumQualification: qualifications.minimumQualification || listing.minimumQualification || null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription: joinDescriptionParts(
      detail.ShortDescriptionStr,
      detail.ExternalDescriptionStr,
      detail.ExternalResponsibilitiesStr,
      detail.ExternalQualificationsStr,
    ) || listing.jobDescription || null,
    remoteStatus: null,
    siteNumber: SITE_NUMBER,
  }
}

const nativeFetch=async(url,options)=>{
  const response=await fetch(url,options)
  options.signal?.throwIfAborted()
  if(response.url&&response.url!==url)throw Object.assign(new Error('Amneal India native response redirected away from the requested surface'),{abortRetries:true})
  return response
}
const defaultFetchText = (url,{signal}={}) => fetchTextWithRetry(url, {
  signal,fetchImpl:nativeFetch,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url,{signal}={}) => fetchJsonWithRetry(url, {
  signal,fetchImpl:nativeFetch,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createAmnealPharmaceuticalsIndiaScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
  sourceTimeoutMs = 180000,
  onAudit,
} = {}) => ({
  async run({signal: callerSignal,onAudit: runAudit}={}) {
    const signal=AbortSignal.any([AbortSignal.timeout(sourceTimeoutMs),...(callerSignal?[callerSignal]:[])])
    const wait=promise=>new Promise((resolve,reject)=>{
      const finish=(fn,value)=>{signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason)
      signal.addEventListener('abort',abort,{once:true})
      Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()
    })
    let pagesFetched=0,listingPaginationComplete=false,observedListingCount=0,observedIndiaListingCount=0
    const failures=[],seenJobIds=new Set(),openingPages=[]
    const signature=payload=>JSON.stringify({total:payload?.items?.[0]?.TotalJobsCount,rows:getRequisitionList(payload)})
    const read=async(fn,url)=>{signal.throwIfAborted();const result=await wait(fn(url,{signal}));signal.throwIfAborted();pagesFetched++;return result}
    const finish=async jobs=>{
      let closingInventoryMatches=false
      if(listingPaginationComplete){
        try{
          closingInventoryMatches=true
          for(const opening of openingPages)if(signature(await read(fetchJson,opening.url))!==opening.signature)closingInventoryMatches=false
          const closingCareers=await read(fetchText,OFFICIAL_CAREERS_URL)
          if(!hasOfficialCareersPageSignal(closingCareers)||readAmnealCareersHandoff(closingCareers)!==openingHandoff
            ||!hasOfficialCandidateExperienceSignal(await read(fetchText,CANDIDATE_EXPERIENCE_URL)))closingInventoryMatches=false
          if(!closingInventoryMatches)failures.push({stage:'native-inventory',failureKind:'closing-native-inventory-or-employer-handoff-changed'})
        }catch(error){signal.throwIfAborted();closingInventoryMatches=false;failures.push({stage:'native-inventory',failureKind:'closing-native-inventory-unavailable',message:error.message})}
      }
      const expected=Number(openingPages[0]?.total)
      const countsReconciled=listingPaginationComplete&&Number.isSafeInteger(expected)&&observedListingCount===expected
        &&seenJobIds.size===observedIndiaListingCount&&observedListingCount===observedIndiaListingCount
      if(listingPaginationComplete&&!countsReconciled)failures.push({stage:'native-inventory',failureKind:'native-total-unique-India-identities-or-country-scope-not-reconciled'})
      const inventoryComplete=countsReconciled&&closingInventoryMatches
      for(const job of jobs)job.sourceListingComplete=inventoryComplete
      if(jobs.length)jobs[0].nativeCollectionEvidence={source:SOURCE,candidateDetails:seenJobIds.size,
        extractedDetailJobs:jobs.length,jobs:jobs.map(job=>({id:job.jobId})),exclusions:[],failures,
        observedListingCount,observedIndiaListingCount,nonIndiaListingCount:observedListingCount-observedIndiaListingCount,
        listingPaginationComplete,closingInventoryMatches,sourceScopeComplete:false,declaredIndiaInventoryComplete:inventoryComplete}
      attachInventoryEvidence(jobs,{status:inventoryComplete?'complete-inventory':'coverage-gap',surface:CANDIDATE_EXPERIENCE_URL,
      firstParty:true,listingComplete:inventoryComplete,pagesFetched,reportedTotal:inventoryComplete?expected:null,indiaFacetCount:inventoryComplete?observedIndiaListingCount:null,verifiedAt:now(),
      reason:'Declared native Amneal India board; full opening/closing listing models and employer handoff checked; company-wide channels not claimed'
        +`; pagination-complete:${listingPaginationComplete}; closing-match:${closingInventoryMatches}; counts-reconciled:${countsReconciled}`
        +(failures.length?'; retained-native-failures:'+failures.map(failure=>(failure.nativeJobId||'inventory')+':'+failure.failureKind).join(','):'')})
      if(runAudit||onAudit)await wait((runAudit||onAudit)({source:SOURCE,observedListingCount,observedIndiaListingCount,listingPaginationComplete,closingInventoryMatches,inventoryComplete,failures,productionWrites:false}))
      signal.throwIfAborted();return jobs
    }
    const careersHtml = await read(fetchText,OFFICIAL_CAREERS_URL)
    const openingHandoff=readAmnealCareersHandoff(careersHtml)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Amneal Pharmaceuticals India verified Amneal India careers landing page no longer matches the known first-party surface')
    }

    if(readAmnealCareersHandoff(careersHtml)===SEARCH_CAREERS_URL){
      const searchHtml = await read(fetchText,SEARCH_CAREERS_URL)
      if (!hasOfficialSearchPageSignal(searchHtml)) {
        throw new Error('Amneal Pharmaceuticals India verified Amneal India search careers page no longer matches the known first-party handoff')
      }
    }

    const candidateExperienceHtml = await read(fetchText,CANDIDATE_EXPERIENCE_URL)
    if (!hasOfficialCandidateExperienceSignal(candidateExperienceHtml)) {
      throw new Error('Amneal Pharmaceuticals India verified Oracle candidate experience page no longer matches the known public shell')
    }

    const jobs = []

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await read(fetchJson,buildSearchUrl({ page }))
      const pageJobs = extractSearchResults(payload)
      const summary = extractPaginationSummary(payload, { page })
      const rawTotal=payload?.items?.[0]?.TotalJobsCount
      if(rawTotal===null||rawTotal===undefined||rawTotal===''||!Number.isSafeInteger(Number(rawTotal))||Number(rawTotal)<0
        ||getRequisitionList(payload).length>summary.pageSize)throw new Error('Amneal native listing total or page cardinality is unavailable')
      openingPages.push({url:buildSearchUrl({page}),signature:signature(payload),total:rawTotal})
      observedListingCount+=getRequisitionList(payload).length
      observedIndiaListingCount+=pageJobs.length

      for (const listing of pageJobs) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await read(fetchJson,buildJobDetailApiUrl(listing.jobId))
        let detail
        try{detail=extractJobDetail(detailPayload,listing)}catch(error){
          if(error?.code!=='AMNEAL_NATIVE_DESCRIPTION_UNAVAILABLE'||error.nativeJobId!==listing.jobId)throw error
          failures.push({stage:'native-detail',nativeJobId:listing.jobId,sourceUrl:listing.sourceUrl,failureKind:'missing-native-description'})
          continue
        }

        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: now(),
          sourceListingComplete:false,
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return finish(jobs)
        }
      }

      if (!summary.hasNext){listingPaginationComplete=true;break}
    }

    return finish(jobs)
  },
})

export const run = async (options = {}) => createAmnealPharmaceuticalsIndiaScraper(options).run(options)

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
