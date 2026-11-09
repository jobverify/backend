import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HTC_GLOBAL_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HTC_GLOBAL_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_LISTING_URL = PROVIDER_METADATA.jobsListingPageUrl
export const JOBS_PROXY_URL = PROVIDER_METADATA.jobsProxyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_STATE_CODES = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CT: 'Chhattisgarh',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UT: 'Uttarakhand',
  WB: 'West Bengal',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (!match) return normalized

  const [, month, day, year] = match
  return `${year}-${month}-${day}`
}

const isIndiaStateCode = (value) => Object.hasOwn(INDIA_STATE_CODES, String(value ?? '').toUpperCase())

const buildLocation = ({ city, stateCode }) => {
  const normalizedCity = normalizeWhitespace(city)
  const fullState = INDIA_STATE_CODES[String(stateCode ?? '').toUpperCase()] || null
  return [normalizedCity, fullState, 'India'].filter(Boolean).join(', ')
}

export const buildJobDetailUrl = (jobCode) =>
  `https://www.htcinc.com/job-detail/?jobcode=${encodeURIComponent(String(jobCode))}`

export const buildJobApplyUrl = (jobCode) =>
  `https://www.htcinc.com/apply-now/?jobcode=${encodeURIComponent(String(jobCode))}`

export const hasOfficialCareersLandingSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers in AI &amp; Agentic AI \| Transform Enterprise Change – HTC\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.htcinc\.com\/careers\/["']/i.test(page)
    && /Join HTC in shaping enterprise transformation through AI and Agentic AI/i.test(page)
    && page.includes('https://www.htcinc.com/career-job-listing/')
}

export const hasOfficialJobsListingSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers at HTC Global \| Work on AI &amp; Agentic AI Innovation\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.htcinc\.com\/career-job-listing\/["']/i.test(page)
    && normalized.includes('All Jobs')
    && normalized.includes('Loading...')
    && page.includes(JOBS_PROXY_URL)
  }

export const extractIndiaJobsFromProxyPayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.data?.jobs) ? payload.data.jobs : null
  if (!jobs) {
    throw new Error('HTC Global Services jobs proxy response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => isIndiaStateCode(job?.state_code))
    .map((job) => {
      const requisitionId = normalizeWhitespace(job?.requisition_number)
      const city = normalizeCity(normalizeWhitespace(job?.location_name))

      return {
        title: normalizeWhitespace(job?.job_title),
        company: COMPANY_NAME,
        department: null,
        location: buildLocation({
          city,
          stateCode: job?.state_code,
        }),
        city,
        country: 'India',
        jobId: requisitionId,
        requisitionId,
        sourceUrl: buildJobDetailUrl(requisitionId),
        applyUrl: buildJobApplyUrl(requisitionId),
        employmentType: normalizeWhitespace(job?.employment_type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDate(job?.posted_date),
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.job_description),
        source: SOURCE,
        link: buildJobApplyUrl(requisitionId),
        scrapedAt,
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: JOBS_LISTING_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHtcGlobalServicesScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersLandingHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error('HTC Global Services verified official careers landing no longer matches the trusted public surface')
    }

    const jobsListingHtml = await fetchText(JOBS_LISTING_URL)
    if (!hasOfficialJobsListingSignal(jobsListingHtml)) {
      throw new Error('HTC Global Services verified jobs listing page no longer matches the trusted public surface')
    }

    const jobs = extractIndiaJobsFromProxyPayload(
      await fetchJson(JOBS_PROXY_URL),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createHtcGlobalServicesScraper(options).run(options)

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
