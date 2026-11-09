import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from '../../scraper-support/myworkday/engine.js'

import { ENFUSION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ENFUSION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const ENFUSION_HOMEPAGE_URL = PROVIDER_METADATA.enfusionHomepageUrl
export const OFFICIAL_HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.firstPartyJobsApiUrl
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const VERIFIED_INDIA_LOCATION_REFERENCES =
  PROVIDER_METADATA.verifiedIndiaLocationReferences

const ACCEPTED_WORKDAY_BOARD_URLS = [
  WORKDAY_BOARD_URL,
  'https://clearwateranalytics.wd1.myworkdayjobs.com/en-US/Clearwater_Analytics_Careers',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERNS = [
  { pattern: /\bBengaluru\b/i, city: 'Bengaluru' },
  { pattern: /\bBangalore\b/i, city: 'Bangalore' },
  { pattern: /\bNoida\b/i, city: 'Noida' },
  { pattern: /\bPune\b/i, city: 'Pune' },
  { pattern: /\bMumbai\b/i, city: 'Mumbai' },
  { pattern: /\bChennai\b/i, city: 'Chennai' },
  { pattern: /\bHyderabad\b/i, city: 'Hyderabad' },
  { pattern: /\bGurugram\b/i, city: 'Gurugram' },
  { pattern: /\bGurgaon\b/i, city: 'Gurgaon' },
]

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#43;/gi, '+')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).replace(/[_-]+/g, ' ')
  return normalized || null
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

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    redirect: 'follow',
  })

  const text = await response.text()
  return JSON.parse(text)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /Unified Front-to-Back Investment Management Platform \| Clearwater/i.test(page)
    && /Enfusion by Clearwater/i.test(page)
    && /(?:https:\/\/cwan\.com)?\/products\/enfusion\//i.test(page)
    && /https:\/\/webapp\.enfusionsystems\.com\//i.test(page)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Careers in Investment Technology \| Clearwater/i.test(page)
    && /Enfusion by Clearwater/i.test(page)
    && /WORKDAY/i.test(page)
    && /workday-feed/i.test(page)
    && /blocks\/workday\/script\.js/i.test(page)
}

export const hasOfficialWorkdayBoardSignal = (page = {}) => {
  const finalUrl = getFinalUrl(page, WORKDAY_BOARD_URL)
  const html = String(page.html ?? '')

  return Number(page.status) === 200
    && ACCEPTED_WORKDAY_BOARD_URLS.some((candidate) => sameUrl(finalUrl, candidate))
    && /rel=["']canonical["'][^>]*href=["']https:\/\/clearwateranalytics\.wd1\.myworkdayjobs\.com\/Clearwater_Analytics_Careers["']/i.test(html)
    && /property=["']og:title["'][^>]*content=["']Careers["']/i.test(html)
    && /tenant:\s*"clearwateranalytics"/i.test(html)
    && /siteId:\s*"Clearwater_Analytics_Careers"/i.test(html)
}

const getPostingData = (posting = {}) => posting?.Job_Posting_Data || {}

const getLocationReference = (posting = {}) =>
  normalizeWhitespace(
    getPostingData(posting)?.Job_Posting_Location_Data?.Primary_Location_Reference?.ID?.[1],
  )

export const isEnfusionPosting = (posting = {}) => {
  const postingData = getPostingData(posting)
  const title = normalizeWhitespace(postingData?.Job_Posting_Title)
  const description = normalizeWhitespace(postingData?.Job_Posting_Description)

  return /\bEnfusion\b/i.test(title) || /\bEnfusion\b/i.test(description)
}

export const isIndiaLocationReference = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/\bLOC-India Office\b/i.test(normalized)) return true
  if (/\bRemote\b/i.test(normalized) && /\bIndia\b/i.test(normalized)) return true

  return INDIA_LOCATION_PATTERNS.some(({ pattern }) => pattern.test(normalized))
}

const parseIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)

  if (!normalized) {
    return {
      location: COUNTRY_FILTER,
      city: null,
      state: null,
      country: COUNTRY_FILTER,
    }
  }

  if (/\bLOC-India Office\b/i.test(normalized)) {
    return {
      location: COUNTRY_FILTER,
      city: null,
      state: null,
      country: COUNTRY_FILTER,
    }
  }

  if (/\bRemote\b/i.test(normalized) && /\bIndia\b/i.test(normalized)) {
    return {
      location: `Remote, ${COUNTRY_FILTER}`,
      city: null,
      state: null,
      country: COUNTRY_FILTER,
    }
  }

  for (const { pattern, city } of INDIA_LOCATION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        location: `${city}, ${COUNTRY_FILTER}`,
        city,
        state: null,
        country: COUNTRY_FILTER,
      }
    }
  }

  return {
    location: `${normalized}, ${COUNTRY_FILTER}`,
    city: null,
    state: null,
    country: COUNTRY_FILTER,
  }
}

const extractJobId = (postingData = {}) => {
  const requisitionId = normalizeWhitespace(postingData?.Job_Requisition_ID)
  if (requisitionId) return requisitionId

  const externalPath = normalizeWhitespace(postingData?.External_Job_Path)
  const pathMatch = externalPath.match(/_([A-Z0-9-]+)$/i)
  return pathMatch?.[1] || null
}

const normalizePosting = (posting = {}, scrapedAt) => {
  const postingData = getPostingData(posting)
  const title = normalizeWhitespace(postingData?.Job_Posting_Title)
  const description = normalizeWhitespace(postingData?.Job_Posting_Description)
  const sourceUrl = normalizeWhitespace(postingData?.External_Job_Path)
  const applyUrl = normalizeWhitespace(postingData?.External_Apply_URL)
  const jobId = extractJobId(postingData)
  const locationReference = getLocationReference(posting)
  const locationBits = parseIndiaLocation(locationReference)
  const department = normalizeWhitespace(postingData?.Job_Family_Reference?.ID?.[1]) || null

  if (!title || !description || !sourceUrl || !applyUrl || !jobId || !locationReference) {
    throw new Error('Enfusion jobs API payload changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY,
    department,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    sourceUrl,
    applyUrl,
    employmentType: normalizeEmploymentType(postingData?.Time_Type_Reference?.ID?.[1]),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(postingData?.Job_Posting_Start_Date) || null,
    closingDate: null,
    jobDescription: description || null,
    requisitionId: jobId,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

export const extractEnfusionIndiaJobsFromPayload = (payload = {}, scrapedAt) => {
  const postings = Array.isArray(payload?.Job_Posting) ? payload.Job_Posting : null
  if (!postings) {
    throw new Error('Enfusion jobs API payload changed materially')
  }

  return postings
    .filter((posting) => isEnfusionPosting(posting))
    .filter((posting) => isIndiaLocationReference(getLocationReference(posting)))
    .map((posting) => normalizePosting(posting, scrapedAt))
    .sort((left, right) =>
      left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
}

export const createEnfusionScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const homepage = await fetchPage(ENFUSION_HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(getFinalUrl(homepage, ENFUSION_HOMEPAGE_URL), OFFICIAL_HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Enfusion verified official Enfusion homepage redirect changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(getFinalUrl(careersPage, CAREERS_URL), CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Enfusion verified first-party careers surface changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    if (hasWorkdayOutageSignal(workdayBoardPage)) {
      throw new WorkdayUpstreamOutageError(`[${SOURCE}] Workday is currently unavailable upstream at ${WORKDAY_BOARD_URL}`)
    }
    if (workdayBoardPage.status !== 200) {
      throw new Error(`HTTP ${workdayBoardPage.status} for ${WORKDAY_BOARD_URL}`)
    }
    if (!hasOfficialWorkdayBoardSignal(workdayBoardPage)) {
      throw new Error('Enfusion verified public Workday board changed materially')
    }

    const payload = await fetchJson(JOBS_API_URL)
    const jobs = extractEnfusionIndiaJobsFromPayload(payload, now())

    return Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createEnfusionScraper(options).run(options)

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
