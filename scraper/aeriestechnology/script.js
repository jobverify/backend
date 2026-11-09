import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {runNativeAeries} from './nativeRun.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

import { AERIES_TECHNOLOGY_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const SEARCH_JOBS_SERVICE_URL = new URL(
  '../Services/SearchJobsService.asmx/GetHotLinksAndJobs',
  JOBS_BOARD_URL,
).toString()

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const stripTags = (value) => normalizeText(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = JOBS_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const firstMatch = (value, patterns) => {
  for (const pattern of patterns) {
    const match = String(value ?? '').match(pattern)
    const normalized = normalizeText(match?.[1])
    if (normalized) return normalized
  }

  return null
}

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const splitSkills = (value) => normalizeText(value)
  ?.split(/\s*,\s*/)
  .map((item) => normalizeText(item))
  .filter(Boolean)
  || []

const hasForeignMarker = (value) =>
  /\b(united states|usa|canada|uk|united kingdom|europe|australia|singapore)\b/i.test(String(value ?? ''))

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeText(value)
  if (!normalized || hasForeignMarker(normalized)) return null
  return /india$/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (location) => normalizeText(String(location ?? '').split(',')[0])

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
  },
  body: JSON.stringify(body),
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers - Aeries Technology\s*<\/title>/i.test(page)
    && /View Current Openings/i.test(text)
    && extractJobsBoardUrl(page) === JOBS_BOARD_URL
}

export const extractJobsBoardUrl = (html = '') =>
  toAbsoluteUrl(firstMatch(html, [
    /href=["'](https:\/\/aeriestechnology\.talentrecruit\.com\/Search\/?)["']/i,
    /href=["'](https:\/\/aeriestechnology\.talentrecruit\.com\/?)["']/i,
  ]), JOBS_BOARD_URL)

export const hasJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Aeries Technology\s*<\/title>/i.test(page)
    && /Job By Location/i.test(text)
    && (/SearchJobsService\.asmx/i.test(page) || /app\.controller-search-job\.js/i.test(page))
}

export const buildBoardRequestBody = ({ pageIndex = 1 } = {}) => ({
  parameters: JSON.stringify({
    intFunctionalArea: 0,
    intPageIndex: Math.max(1, Number(pageIndex) || 1),
    searchKeyword: '',
    strLocation: '',
    jobSearch: '',
    queryString: '',
    FilterDataSource: null,
  }),
})

const unwrapJobsPayload = (payload = {}) => {
  const rawPayload = payload?.d ?? payload

  if (typeof rawPayload === 'string') {
    try {
      return JSON.parse(rawPayload)
    } catch {
      return {}
    }
  }

  return rawPayload || {}
}

export const buildJobDetailUrl = (requisitionId, title) => {
  const jobId = normalizeText(requisitionId)
  if (!jobId) return null

  const slug = slugify(title)
  const suffix = slug ? `-${slug}` : ''
  return toAbsoluteUrl(`Jobs/?${jobId}${suffix}`)
}

const extractDepartment = (record = {}) => normalizeText(
  record.FunctionalArea
    || record.BusinessVertical
    || record.Industry,
)

export const extractListingCards = (payload = {}) => {
  const jobsPayload = unwrapJobsPayload(payload)
  const listings = Array.isArray(jobsPayload?.Jobs) ? jobsPayload.Jobs : []

  return listings
    .map((record) => {
      const title = normalizeText(record.JOB_TITLE)
      const requisitionId = normalizeText(record.REF_REQ_ID) || slugify(title)
      const location = normalizeIndiaLocation(record.FULL_JOB_LOCATION || record.JOB_LOCATION)
      const detailUrl = buildJobDetailUrl(requisitionId, title)

      if (!title || !requisitionId || !location || !detailUrl) return null

      return {
        title,
        department: extractDepartment(record),
        location,
        city: extractCity(location),
        jobId: requisitionId,
        requisitionId,
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        experienceRequired: normalizeText(record['Job Experience'] || record['Years of Experience']),
        requiredSkills: splitSkills(record.KeySkills || record['Skill Name'] || record.PrimarySkillName),
        jobDescription: stripTags(record.JOB_DESCRIPTION || record.JOB_DETAILS || record.REMARKS),
      }
    })
    .filter(Boolean)
}

export const createAeriesTechnologyScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Aeries Technology verified careers page no longer matches the trusted first-party surface')
    }

    const jobsBoardUrl = extractJobsBoardUrl(careersHtml)
    if (jobsBoardUrl !== JOBS_BOARD_URL) {
      throw new Error('Aeries Technology verified careers page no longer resolves to the trusted TalentRecruit board')
    }

    const boardHtml = await fetchText(jobsBoardUrl)
    if (!hasJobsBoardSignal(boardHtml)) {
      throw new Error('Aeries Technology verified board no longer matches the trusted public jobs surface')
    }

    const jobsPayload = await fetchJson(SEARCH_JOBS_SERVICE_URL, buildBoardRequestBody())
    const jobs = extractListingCards(jobsPayload)
    if (jobs.length === 0) {
      throw new Error('Aeries Technology verified board API no longer exposes trusted public jobs listings')
    }

    return attachInventoryEvidence(jobs.map((job) => ({
      ...job,
      company: COMPANY,
      country: 'India',
      employmentType: null,
      experienceRequired: job.experienceRequired || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: job.requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      sourceListingComplete: false,
      sourceDetailComplete: false,
    })),{status:'discovery-only',surface:JOBS_BOARD_URL,firstParty:true,listingComplete:false,reason:'legacy-listing-teaser-path-without-full-native-detail-proof'})
  },
})

export const run = runNativeAeries

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
