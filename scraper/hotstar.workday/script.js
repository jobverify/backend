import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { HOTSTAR_CATALOG } from './catalog.js'
import { collectHotstarNative } from './nativeDetails.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HOTSTAR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_KEYWORD = PROVIDER_METADATA.verifiedKeyword
export const VERIFIED_JOB_URL = PROVIDER_METADATA.verifiedJobUrl
export const VERIFIED_APPLY_URL = PROVIDER_METADATA.verifiedApplyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const PAGE_SIZE = 20
const HOMEPAGE_ACCEPTED_URLS = [
  HOMEPAGE_URL,
  'https://www.hotstar.com/in',
  'https://www.hotstar.com/in/',
]

const WORKDAY_BOARD_ACCEPTED_URLS = [
  WORKDAY_BOARD_URL,
  'https://jiostar.wd102.myworkdayjobs.com/JioStar/',
  'https://jiostar.wd102.myworkdayjobs.com/en-US/JioStar',
  'https://jiostar.wd102.myworkdayjobs.com/en-US/JioStar/',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
  .replace(/&#x([0-9a-f]+);/gi, (_, hexCodePoint) => String.fromCodePoint(parseInt(hexCodePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

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

const isAcceptedHomepageUrl = (value) =>
  HOMEPAGE_ACCEPTED_URLS.some((candidate) => sameUrl(value, candidate))

const isAcceptedWorkdayBoardUrl = (value) =>
  WORKDAY_BOARD_ACCEPTED_URLS.some((candidate) => sameUrl(value, candidate))

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const normalizedHomepage = normalized.replace(/\u2019/g, "'")

  if (
    /<title>\s*JioHotstar\s*-\s*Watch TV Shows, Movies, Specials, Live Cricket\s*&amp;\s*Football\s*<\/title>/i.test(page)
    && /JioHotstar is India's largest premium streaming platform/i.test(normalizedHomepage)
  ) {
    return true
  }

  return (
    (
      /<title>\s*JioHotstar\s*-\s*Watch TV Shows, Movies, Specials, Live Cricket\s*&amp;\s*Football\s*<\/title>/i.test(page)
      && /JioHotstar is India(?:'|â€™|&#8217;|Ã¢â‚¬â„¢)?s largest premium streaming platform/i.test(normalized)
    )
    || (
      /Looks like you are connecting through a VPN, proxy or 'unblocker' service\./i.test(page)
      && /Cookie Settings/i.test(page)
    )
  )
}

export const hasBlockedJiostarCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Error\s*<\/title>/i.test(page)
    && normalized.includes('An error occurred while processing your request.')
    && /errors\.edgesuite\.net/i.test(normalized)
    && /Reference\s+#/i.test(normalized)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const normalizedTitlePage = page.replace(/\u2019/g, "'")

  return /<title>\s*JioStar\s*-\s*India(?:'|â€™|&#8217;|Ã¢â‚¬â„¢)?s Largest Media Conglomerate\s*\|\s*Entertainment Reimagined\s*<\/title>/i.test(normalizedTitlePage)
    && /jiostar\.wd102\.myworkdayjobs\.com\/JioStar/i.test(page)
    && (
      /Jio Hotstar streaming platform/i.test(normalized)
      || /Perched firmly at the nucleus of spellbinding content/i.test(normalized)
      || /# JioStar/i.test(page)
    )
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isAcceptedWorkdayBoardUrl(match[1])) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (page = {}) => {
  const html = String(page.html ?? '')
  const finalUrl = getFinalUrl(page, WORKDAY_BOARD_URL)

  return Number(page.status) === 200
    && isAcceptedWorkdayBoardUrl(finalUrl)
    && /rel=["']canonical["'][^>]*href=["']https:\/\/jiostar\.wd102\.myworkdayjobs\.com\/JioStar["']/i.test(html)
    && /window\.workday\s*=\s*window\.workday/i.test(html)
    && /tenant:\s*"jiostar"/i.test(html)
    && /siteId:\s*"JioStar"/i.test(html)
    && /appName:\s*"cxs"/i.test(html)
}

export const buildKeywordSearchRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: VERIFIED_KEYWORD,
})

const extractJobId = (posting = {}) => {
  const bulletFieldJobId = (Array.isArray(posting?.bulletFields) ? posting.bulletFields : [])
    .find((value) => /^JR\d+$/i.test(String(value)))

  if (bulletFieldJobId) return bulletFieldJobId

  return String(posting?.externalPath ?? '').match(/_(JR\d+)(?:\/)?$/i)?.[1] || null
}

const extractPrimaryLocationSegment = (externalPath) =>
  String(externalPath ?? '').match(/\/job\/([^/]+)\//i)?.[1] ?? null

const extractPrimaryCity = (posting = {}) => {
  const locationText = normalizeWhitespace(posting?.locationsText)
  const rawSegment = normalizeWhitespace(
    decodeURIComponent(extractPrimaryLocationSegment(posting?.externalPath) ?? '').replace(/\+/g, ' '),
  )

  const locationCandidate = locationText
    ? locationText.split(/\s+-\s+/)[0]
    : rawSegment?.split('---')[0]

  return normalizeCity(locationCandidate) || null
}

const normalizeIndiaLocation = (posting = {}) => {
  const city = extractPrimaryCity(posting)

  return {
    location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
    city,
    state: null,
    country: COUNTRY_FILTER,
  }
}

const buildDetailUrl = (externalPath) => {
  const normalized = String(externalPath ?? '')
  if (!normalized) return null

  try {
    if (/^https?:\/\//i.test(normalized)) {
      return normalized.split('?')[0]
    }

    if (normalized.startsWith('/')) {
      return `${WORKDAY_BOARD_URL}${normalized}`.split('?')[0]
    }

    return new URL(normalized, `${WORKDAY_BOARD_URL}/`).toString().split('?')[0]
  } catch {
    return null
  }
}

const buildApplyUrl = (externalPath) => {
  const detailUrl = buildDetailUrl(externalPath)
  return detailUrl ? `${detailUrl}/apply` : null
}

const normalizePosting = (posting = {}, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const jobId = extractJobId(posting)
  const sourceUrl = buildDetailUrl(posting?.externalPath)
  const applyUrl = buildApplyUrl(posting?.externalPath)
  const locationBits = normalizeIndiaLocation(posting)

  if (!title || !jobId || !sourceUrl || !applyUrl || !locationBits.location) {
    throw new Error('Hotstar verified Workday jobs payload changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY_NAME,
    department: null,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    sourceUrl,
    applyUrl,
    employmentType: normalizeWhitespace(posting?.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(posting?.postedOn),
    closingDate: null,
    jobDescription: null,
    requisitionId: jobId,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

export const extractJobsFromPayload = (payload = {}, scrapedAt) =>
  (Array.isArray(payload?.jobPostings) ? payload.jobPostings : [])
    .map((posting) => normalizePosting(posting, scrapedAt))

export const createHotstarScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage,
    fetchJson,
    now = defaultNow,
    ...options
  } = {}) {
    return collectHotstarNative({options:{...options,fetchPage,fetchJson,now,maxPages,maxJobs:maxJobs??10000},
      metadata:{homepage:HOMEPAGE_URL,careers:CAREERS_URL,board:WORKDAY_BOARD_URL,jobsAPI:JOBS_API_URL,searchText:VERIFIED_KEYWORD},
      normalizePosting,
      validators:{homepage:page=>{if(page.status!==200||!isAcceptedHomepageUrl(page.url)||!hasOfficialHomepageSignal(page.html))throw new Error('Hotstar verified homepage surface changed materially')},
        careers:page=>{if(page.status!==200||!sameUrl(page.url,CAREERS_URL)||!hasOfficialCareersSignal(page.html)
          ||!sameUrl(extractVerifiedWorkdayBoardUrl(page.html),WORKDAY_BOARD_URL))throw new Error('Hotstar current corporate Careers delegation changed')},
        board:page=>{assertWorkdayPageAvailable(page,{source:SOURCE,url:WORKDAY_BOARD_URL});if(!hasOfficialWorkdayBoardSignal(page))throw new Error('Hotstar verified public Workday board changed materially')}}})
  },
})

export const run = async (options = {}) => createHotstarScraper(options).run(options)

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
