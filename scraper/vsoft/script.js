import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'vsoft'
export const COMPANY = 'VSoft'
export const VERIFIED_ON = '2026-10-03'
export const CAREERS_PAGE_URL = 'https://www.vsoftconsulting.com/careers/'
export const CAREER_PORTAL_URL = 'https://www.vsoftconsulting.com/career-portal/'
export const JOBDIVA_PORTAL_URL =
  'https://www1.jobdiva.com/portal/?a=ehjdnwnz6myv05mxjimlmwguleo14c0be149kcy238wtxsp4ozlqyjqehdl6g0y1&compid=-1'
export const JOBDIVA_AUTH_URL = 'https://ws.jobdiva.com/candPortal/rest/auth/a'
export const JOBDIVA_LIST_ALL_URL = 'https://ws.jobdiva.com/candPortal/rest/job/listall'
export const JOBDIVA_GET_MORE_URL = 'https://ws.jobdiva.com/candPortal/rest/job/getmore'
export const JOBDIVA_DETAIL_URL_PREFIX = 'https://ws.jobdiva.com/candPortal/rest/job/getdetailbyjobid/'
export const JOBDIVA_PUBLIC_PORTAL_TYPE = '1'
export const JOBDIVA_PUBLIC_COMPID = '-1'
export const JOBDIVA_PUBLIC_AUTHORIZATION = 'Basic YXhlbG9uOmF4ZWxvbg=='
export const DEFAULT_PAGE_SIZE = 200

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_PAGE_SIGNAL_PATTERNS = [
  /<title>\s*Careers(?:\s*-\s*V-Soft Consulting\s*\|\s*Enterprise AI(?:\s*&amp;\s*|\s*&\s*)Digital Transformation|\s*\|\s*V-Soft Consulting)\s*<\/title>/i,
  /https:\/\/www\.vsoftconsulting\.com\/career-portal\/?/i,
  /\b(?:Browse Open Roles|View jobs)\b/i,
]

const CAREER_PORTAL_SIGNAL_PATTERNS = [
  /<title>\s*V-Soft Consulting Careers and IT Opportunities\s*<\/title>/i,
  /\bjobdiva-careers\b/i,
  /<iframe\b/i,
]

const INDIA_LOCATION_KEYWORDS = [
  'india',
  'hyderabad',
  'noida',
  'bengaluru',
  'bangalore',
  'pune',
  'mumbai',
  'chennai',
  'delhi',
  'gurgaon',
  'gurugram',
  'kolkata',
  'ahmedabad',
  'coimbatore',
  'kochi',
  'ernakulam',
  'thiruvananthapuram',
  'trivandrum',
  'telangana',
  'karnataka',
  'maharashtra',
  'tamil nadu',
  'kerala',
  'west bengal',
  'gujarat',
  'haryana',
  'uttar pradesh',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const normalizeLocationPart = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return /^[a-z][a-z\s-]*$/i.test(normalized) && normalized === normalized.toLowerCase()
    ? normalized.replace(/\b[a-z]/g, (match) => match.toUpperCase())
    : normalized
}

const toIsoDate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString()
}

const toLocationText = (value) => {
  if (!value) return null
  if (typeof value === 'string') return normalizeWhitespace(value)

  return [
    normalizeLocationPart(value.city),
    normalizeLocationPart(value.state),
    normalizeLocationPart(value.country),
  ]
    .filter(Boolean)
    .join(', ') || null
}

const buildRequestHeaders = (defaultHeaders, options = {}) => {
  const { headers = {}, ...rest } = options
  return {
    ...rest,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  }
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, buildRequestHeaders({
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}, {
  label: 'vsoft-text',
  timeoutMs: 15000,
  ...options,
}))

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, buildRequestHeaders({
  'User-Agent': USER_AGENT,
  Accept: 'application/json, text/plain, */*',
}, {
  label: 'vsoft-json',
  timeoutMs: 15000,
  ...options,
}))

const isJobDivaPortalUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return /^www\d+\.jobdiva\.com$/i.test(url.hostname)
      && url.pathname === '/portal/'
      && url.searchParams.has('a')
  } catch {
    return false
  }
}

const extractIframeUrlCandidates = (html) => {
  const page = decodeHtmlEntities(String(html ?? ''))

  return [...page.matchAll(/<iframe\b[^>]+(?:data-lazy-src|src)=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter(Boolean)
}

export const hasCareersPageSignal = (html) => CAREERS_PAGE_SIGNAL_PATTERNS.every((pattern) => (
  pattern.test(String(html ?? ''))
))

export const extractJobDivaIframeUrl = (html) => {
  for (const candidate of extractIframeUrlCandidates(html)) {
    try {
      const absoluteUrl = new URL(candidate, CAREER_PORTAL_URL).toString()
      if (isJobDivaPortalUrl(absoluteUrl)) {
        return absoluteUrl
      }
    } catch {
      continue
    }
  }

  return null
}

export const hasCareerPortalPageSignal = (html) => (
  CAREER_PORTAL_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))
  && normalizeUrl(extractJobDivaIframeUrl(html)) === normalizeUrl(JOBDIVA_PORTAL_URL)
)

export const hasJobDivaPortalShellSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Candidate Portal\s*<\/title>/i.test(page)
    && normalized?.includes('You need to enable JavaScript to run this app.')
    && page.includes('var JobPortalEnv = "PRODUCTION"')
    && /\/portal\/index_bundle\.js\.gz\?v=\d{8}_\d+/i.test(page)
    && /\/portal\/1\.index_bundle\.js\.gz\?v=\d{8}_\d+/i.test(page)
}

export const extractJobDivaPortalParams = (portalUrl) => {
  if (!isJobDivaPortalUrl(portalUrl)) {
    return null
  }

  const url = new URL(portalUrl)
  const a = normalizeWhitespace(url.searchParams.get('a'))
  const compid = normalizeWhitespace(url.searchParams.get('compid')) || JOBDIVA_PUBLIC_COMPID

  return a ? { a, compid } : null
}

export const buildJobDivaListAllUrl = (count = DEFAULT_PAGE_SIZE) =>
  `${JOBDIVA_LIST_ALL_URL}?portaltype=${JOBDIVA_PUBLIC_PORTAL_TYPE}&count=${count}`

export const buildJobDivaGetMoreUrl = (from, to, count = DEFAULT_PAGE_SIZE) =>
  `${JOBDIVA_GET_MORE_URL}?from=${from}&to=${to}&count=${count}&portaltype=${JOBDIVA_PUBLIC_PORTAL_TYPE}`

export const buildJobDivaDetailUrl = (jobId, compid = JOBDIVA_PUBLIC_COMPID) =>
  `${JOBDIVA_DETAIL_URL_PREFIX}${encodeURIComponent(String(jobId ?? ''))}?compid=${encodeURIComponent(String(compid))}`

export const buildJobDivaJobUrl = (jobId) =>
  `${JOBDIVA_PORTAL_URL}#/jobs/${encodeURIComponent(String(jobId ?? ''))}`

export const isIndiaSummaryRecord = (record) => {
  const haystack = [
    record?.location,
    toLocationText(record?.mainLocation),
    ...(Array.isArray(record?.otherLocations) ? record.otherLocations.map((value) => toLocationText(value)) : []),
  ]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase()

  return INDIA_LOCATION_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

const buildIndiaLocation = (mainLocation) => [
  normalizeLocationPart(mainLocation?.city),
  normalizeLocationPart(mainLocation?.state),
  'India',
]
  .filter(Boolean)
  .join(', ')

const buildJobDivaApiHeaders = (authPayload) => ({
  portalID: String(authPayload?.portalID ?? ''),
  token: String(authPayload?.token ?? ''),
  a: String(authPayload?.a ?? ''),
})

const fetchJobDivaAuth = async (fetchJson, portalUrl) => {
  const params = extractJobDivaPortalParams(portalUrl)
  if (!params?.a) {
    throw new Error('The verified VSoft JobDiva iframe no longer exposes a usable public portal token')
  }

  const authPayload = await fetchJson(JOBDIVA_AUTH_URL, {
    label: 'vsoft-jobdiva-auth',
    headers: {
      Authorization: JOBDIVA_PUBLIC_AUTHORIZATION,
      portalID: JOBDIVA_PUBLIC_PORTAL_TYPE,
      a: params.a,
      compid: params.compid,
    },
  })

  if (!authPayload?.token || !authPayload?.a || !authPayload?.portalID) {
    throw new Error('The verified VSoft JobDiva auth flow no longer returns a usable public portal token')
  }

  return {
    ...authPayload,
    compid: params.compid,
  }
}

const dedupeSummaryRecords = (records) => {
  const uniqueRecords = new Map()

  for (const record of records) {
    const jobId = normalizeWhitespace(record?.id)
    if (!jobId || uniqueRecords.has(jobId)) continue
    uniqueRecords.set(jobId, record)
  }

  return [...uniqueRecords.values()]
}

const fetchAllJobDivaSummaries = async (fetchJson, authPayload, pageSize = DEFAULT_PAGE_SIZE) => {
  const apiHeaders = buildJobDivaApiHeaders(authPayload)
  const firstPage = await fetchJson(buildJobDivaListAllUrl(pageSize), {
    label: 'vsoft-jobdiva-listall',
    headers: apiHeaders,
  })

  const total = Number(firstPage?.total)
  let records = dedupeSummaryRecords(Array.isArray(firstPage?.data) ? firstPage.data : [])

  if (Number.isFinite(total) && records.length < total) {
    for (let from = records.length + 1; from <= total; from += pageSize) {
      const to = Math.min(from + pageSize - 1, total)
      const page = await fetchJson(buildJobDivaGetMoreUrl(from, to, pageSize), {
        label: 'vsoft-jobdiva-getmore',
        headers: apiHeaders,
      })

      records = dedupeSummaryRecords([
        ...records,
        ...(Array.isArray(page?.data) ? page.data : []),
      ])
    }
  }

  return records
}

const isIndiaDetailRecord = (job) => {
  const country = normalizeWhitespace(job?.mainLocation?.country)?.toLowerCase()
  return country === 'india' || isIndiaSummaryRecord(job)
}

const mapJobDivaDetailToJob = (detailPayload) => {
  const detail = detailPayload?.job ?? detailPayload
  if (!detail || !isIndiaDetailRecord(detail)) {
    return null
  }

  const title = normalizeWhitespace(detail?.title)
  const jobId = normalizeWhitespace(detail?.id)
  if (!title || !jobId) {
    return null
  }

  const requisitionId = normalizeWhitespace(detail?.refNo) || jobId
  const city = normalizeLocationPart(detail?.mainLocation?.city)
  const state = normalizeLocationPart(detail?.mainLocation?.state)
  const location = buildIndiaLocation(detail?.mainLocation) || normalizeWhitespace(detail?.location)
  const jobDescription = stripTags(detail?.jobDescription)

  return {
    title,
    company: COMPANY,
    department: /^\d+$/.test(String(detail?.jobSector ?? '').trim())
      ? null
      : normalizeWhitespace(detail?.jobSector),
    location,
    city,
    state,
    country: 'India',
    jobId,
    requisitionId,
    sourceUrl: buildJobDivaJobUrl(jobId),
    applyUrl: buildJobDivaJobUrl(jobId),
    employmentType: normalizeWhitespace(detail?.positionType),
    postingDate: toIsoDate(detail?.postDate ?? detail?.postDateStr),
    jobDescription,
    requiredSkills: extractListItems(detail?.jobDescription),
  }
}

export const extractJobs = (detailPayloads) =>
  (Array.isArray(detailPayloads) ? detailPayloads : [detailPayloads])
    .map((payload) => mapJobDivaDetailToJob(payload))
    .filter(Boolean)

export const createVsoftScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL, {
      label: 'vsoft-careers-page',
    })
    if (!hasCareersPageSignal(careersHtml)) {
      throw new Error('The verified VSoft careers surface no longer matches the official first-party page')
    }

    const careerPortalHtml = await fetchText(CAREER_PORTAL_URL, {
      label: 'vsoft-career-portal-page',
    })
    if (!hasCareerPortalPageSignal(careerPortalHtml)) {
      throw new Error('The verified VSoft career portal handoff no longer matches the official first-party iframe')
    }

    const jobDivaPortalUrl = extractJobDivaIframeUrl(careerPortalHtml)
    const jobDivaPortalHtml = await fetchText(jobDivaPortalUrl, {
      label: 'vsoft-jobdiva-portal-shell',
    })
    if (!hasJobDivaPortalShellSignal(jobDivaPortalHtml)) {
      throw new Error('The verified VSoft public JobDiva portal no longer matches the trusted embedded jobs board')
    }

    const authPayload = await fetchJobDivaAuth(fetchJson, jobDivaPortalUrl)
    const summaryRecords = await fetchAllJobDivaSummaries(fetchJson, authPayload, pageSize)
    const indiaSummaries = summaryRecords.filter((record) => isIndiaSummaryRecord(record))

    if (indiaSummaries.length === 0) {
      return []
    }

    const detailPayloads = await Promise.all(indiaSummaries.map((record) =>
      fetchJson(buildJobDivaDetailUrl(record.id, authPayload.compid), {
        label: 'vsoft-jobdiva-detail',
        headers: buildJobDivaApiHeaders(authPayload),
      })
    ))

    const jobs = extractJobs(detailPayloads).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: CAREERS_PAGE_URL,
    jobBoardUrl: CAREER_PORTAL_URL,
    jobBoardApi: buildJobDivaListAllUrl(DEFAULT_PAGE_SIZE),
    adapter: 'script',
    atsPlatform: 'jobdiva-candidate-portal',
    countryFilter: 'India',
  },
})

export const run = async (options = {}) => createVsoftScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
