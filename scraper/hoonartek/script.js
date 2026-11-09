import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import { HOONARTEK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HOONARTEK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.officialJobsApiUrl
export const JOB_DETAIL_BASE_URL = PROVIDER_METADATA.publicJobDetailBaseUrl
export const JOB_DETAIL_API_BASE_URL = PROVIDER_METADATA.publicJobDetailApiBaseUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

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
    .replace(/\s+([,.;:!?])/g, '$1')
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

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

const normalizeCountry = (value) => normalizeWhitespace(value)?.toLowerCase() || null

const mapEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^fulltime$/i.test(normalized)) return 'Full-time'
  if (/^parttime$/i.test(normalized)) return 'Part-time'

  return normalized
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('-')
}

const buildExperienceRequired = (start, end) => {
  const normalizedStart = Number(start)
  const normalizedEnd = Number(end)

  if (Number.isFinite(normalizedStart) && Number.isFinite(normalizedEnd)) {
    return `${normalizedStart} to ${normalizedEnd} years`
  }

  if (Number.isFinite(normalizedStart)) return `${normalizedStart}+ years`
  if (Number.isFinite(normalizedEnd)) return `Up to ${normalizedEnd} years`
  return null
}

const normalizePostingDate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString()
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const hasValidListingItem = (item) =>
  item
  && (typeof item.id === 'string' || Number.isFinite(item.id))
  && typeof item.title === 'string'
  && item.title.trim().length > 0
  && typeof item.link === 'string'
  && item.link.trim().length > 0
  && item.office
  && typeof item.office === 'object'

const hasValidDetailRecord = (payload, expectedJobId) => {
  const normalizedExpected = normalizeWhitespace(expectedJobId)
  const normalizedId = normalizeWhitespace(payload?.id)

  return Boolean(
    normalizedId
    && normalizedId === normalizedExpected
    && typeof payload?.title === 'string'
    && payload.title.trim().length > 0
    && typeof payload?.description_external === 'string'
    && payload.description_external.trim().length > 0
  )
}

const isIndiaListing = (item = {}) => {
  const officeCountry = normalizeCountry(item?.office?.country)
  const officeLocation = normalizeWhitespace(item?.office?.location)
  const location = normalizeWhitespace(item?.location)

  return officeCountry === 'india'
    || /(?:^|,)\s*india\s*$/i.test(officeLocation || '')
    || /(?:^|,)\s*india\s*$/i.test(location || '')
}

const toCity = (detailOrStub = {}) => {
  const rawCity = normalizeWhitespace(detailOrStub?.location)
    || normalizeWhitespace(detailOrStub?.office?.city)
    || normalizeWhitespace(detailOrStub?.office?.location)

  return normalizeCity(rawCity || '')
}

export const hasOfficialCareersSignal = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalizedText = stripTags(rawHtml) || ''
  const normalizedUrl = normalizeUrl(page.url)?.replace(/\/+$/, '/')

  return Number(page.status) === 200
    && normalizedUrl === CAREERS_URL
    && /<title>\s*Career\s*-\s*Hoonartek\s*<\/title>/i.test(rawHtml)
    && normalizedText.includes('Current Openings')
    && normalizedText.includes('Please get in touch to explore our current vacancies.')
    && rawHtml.includes(`jQuery.getJSON("${JOBS_API_URL}"`)
    && rawHtml.includes('v.link')
    && rawHtml.includes('v.experience_start')
}

export const hasValidListingPayload = (payload) =>
  Array.isArray(payload?.content)
  && Number.isFinite(Number(payload?.total))
  && payload.content.length > 0
  && payload.content.every(hasValidListingItem)

export const buildJobDetailUrl = (jobId) =>
  `${JOB_DETAIL_BASE_URL}${encodeURIComponent(normalizeWhitespace(jobId) || '')}`

export const buildJobDetailApiUrl = (jobId) =>
  `${JOB_DETAIL_API_BASE_URL}${encodeURIComponent(normalizeWhitespace(jobId) || '')}`

export const extractIndiaListingStubs = (payload) => {
  const listings = Array.isArray(payload?.content) ? payload.content : []

  return listings
    .filter((item) => isIndiaListing(item))
    .map((item) => ({
      jobId: normalizeWhitespace(item.id),
      title: normalizeWhitespace(item.title),
      location: normalizeWhitespace(item.location),
      department: normalizeWhitespace(item.department),
      requisitionId: normalizeWhitespace(item.code),
      experienceRequired: buildExperienceRequired(item.experience_start, item.experience_end),
      sourceUrl: normalizeUrl(item.link),
    }))
    .filter((stub) => stub.jobId && stub.title && stub.sourceUrl)
}

export const buildJobFromDetail = (stub, detailPayload) => {
  if (!hasValidDetailRecord(detailPayload, stub?.jobId)) {
    throw new Error(`Hoonartek SenseHQ job detail payload no longer matches the verified public contract for ${stub?.jobId ?? 'unknown job'}`)
  }

  const city = toCity(detailPayload) || toCity(stub)
  const location = city ? `${city}, India` : 'India'
  const sourceUrl = stub?.sourceUrl || buildJobDetailUrl(detailPayload.id)

  return {
    title: normalizeWhitespace(detailPayload.title) || stub?.title || null,
    company: COMPANY,
    department: normalizeWhitespace(detailPayload.department || stub?.department),
    location,
    city,
    country: 'India',
    jobId: normalizeWhitespace(detailPayload.id) || stub?.jobId || null,
    requisitionId: normalizeWhitespace(detailPayload.code) || stub?.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: mapEmploymentType(detailPayload.job_type),
    experienceRequired:
      buildExperienceRequired(detailPayload.experience_start, detailPayload.experience_end)
      || stub?.experienceRequired
      || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizePostingDate(detailPayload.updated_on),
    closingDate: null,
    jobDescription: stripTags(detailPayload.description_external),
    remoteStatus: normalizeWhitespace(detailPayload.workplace_type),
  }
}

const decorateJob = (job, scrapedAt) => ({
  ...job,
  link: job.applyUrl || job.sourceUrl,
  source: SOURCE,
  companyCareerPage: CAREERS_URL,
  companyDomain: PROVIDER_METADATA.companyDomain,
  atsPlatform: PROVIDER_METADATA.atsPlatform,
  scrapedAt,
})

export const createHoonartekScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersPage)) {
      throw new Error('Hoonartek verified Hoonartek careers page no longer matches the known first-party surface')
    }

    const listPayload = await fetchJson(JOBS_API_URL)
    if (!hasValidListingPayload(listPayload)) {
      throw new Error('Hoonartek SenseHQ postings payload no longer matches the verified public contract')
    }

    const stubs = extractIndiaListingStubs(listPayload)
    const jobs = []
    const unavailableCriteriaIds=[]

    for (const stub of stubs) {
      const detailPayload = await fetchJson(buildJobDetailApiUrl(stub.jobId))
      if(normalizeWhitespace(detailPayload?.id)===stub.jobId&&normalizeWhitespace(detailPayload?.title)===stub.title
        &&normalizeWhitespace(detailPayload?.code)===stub.requisitionId&&detailPayload.job_status==='OPEN'
        &&isIndiaListing(detailPayload)&&typeof detailPayload.description_external==='string'&&!detailPayload.description_external.trim()){
        unavailableCriteriaIds.push(stub.jobId)
        continue
      }
      jobs.push(buildJobFromDetail(stub, detailPayload))

      if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
    }

    const scrapedAt = now()

    const decorated=jobs
      .sort((left, right) => {
        const leftTime = left.postingDate ? Date.parse(left.postingDate) : 0
        const rightTime = right.postingDate ? Date.parse(right.postingDate) : 0
        return rightTime - leftTime
      })
      .map((job) => decorateJob(job, scrapedAt))
    if(unavailableCriteriaIds.length){
      const closing=await fetchJson(JOBS_API_URL)
      if(!hasValidListingPayload(closing)||JSON.stringify(closing)!==JSON.stringify(listPayload)){
        throw new Error('Hoonartek native listing changed while withholding unavailable role criteria')
      }
    }
    if(unavailableCriteriaIds.length||Number(listPayload.total)>listPayload.content.length){
      return attachInventoryEvidence(decorated,{status:'coverage-gap',surface:JOBS_API_URL,firstParty:true,listingComplete:false,
        pagesFetched:2+stubs.length+(unavailableCriteriaIds.length?1:0),reportedTotal:Number(listPayload.total),indiaFacetCount:null,
        verifiedAt:scrapedAt,reason:'native-observed-page:'+listPayload.content.length+'/'+listPayload.total
          +';unavailable-full-native-role-criteria:'+unavailableCriteriaIds.join(',')})
    }
    return decorated
  },
})

export const run = async (options = {}) => createHoonartekScraper(options).run(options)

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
