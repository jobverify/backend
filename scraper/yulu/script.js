import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'yulu'
export const COMPANY = 'Yulu'
export const OFFICIAL_BRAND = 'Yulu'
export const CAREERS_URL = 'https://careers.yulu.bike/'
export const JOBS_BOARD_URL = 'https://yulu.mynexthire.com/employer/jobs/careers'
export const REQUISITION_LIST_URL =
  'https://yulu.mynexthire.com/employer/careers/reqlist/get'
export const CLIENT_DETAILS_URL =
  'https://yulu.mynexthire.com/employer/jobboard/details_by_shortname/get/yulu/'
export const DISPOSITION =
  'verified-first-party-careers-shell-with-mynexthire-public-openings'
export const EXPECTED_LISTINGS_ERROR_MESSAGE =
  'Unable to process your request at this time; please try a little later or contact your administrator!'
export const VERIFIED_ON = '2026-08-01'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://careers.yulu.bike/ remained the live Yulu first-party careers shell, that it embedded the public MyNextHire board at https://yulu.mynexthire.com/employer/jobs/careers, that the public board metadata stayed available at https://yulu.mynexthire.com/employer/jobboard/details_by_shortname/get/yulu/, and that the public requisition list endpoint at https://yulu.mynexthire.com/employer/careers/reqlist/get now returned 4 enumerable India openings including Full Stack Engineer, Assistant Manager - Refurb & Service Operations, and Learning Content Associate. This scraper therefore promotes the verified MyNextHire requisition payload into structured jobs.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUIRED_TEXT_PATTERNS = [
  /\bredefine urban mobility\b/i,
  /\bat yulu,\s*passion meets purpose\b/i,
  /\bwhy join us\?/i,
  /\blife at yulu\b/i,
  /\bstay in touch!?/i,
  /career@yulu\.bike/i,
]

const REQUIRED_HTML_PATTERNS = [
  /https:\/\/yulu\.mynexthire\.com\/employer\/ui\/js\/jobboard\/careers-integration\.js/i,
  /mnh_ci_onreadystatechange\(["']careers["'],\s*["']yulu["']/i,
  /<iframe[^>]*id=["']mnhembedded["'][^>]*>/i,
  /id=["']target["']/i,
  /scrollToDiv\(\)/i,
]

const normalizeText = (value = '') =>
  String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()

export const buildListingsRequestBody = () => ({
  source: 'careers',
  code: '',
  filterByBuId: -1,
})

export const hasVerifiedCareersSurface = (html = '') => {
  const rawHtml = String(html)
  const text = normalizeText(rawHtml)

  return REQUIRED_TEXT_PATTERNS.every((pattern) => pattern.test(text))
    && REQUIRED_HTML_PATTERNS.every((pattern) => pattern.test(rawHtml))
}

export const hasExpectedListingsError = (payload = {}) =>
  normalizeText(payload?.errorMessage) === EXPECTED_LISTINGS_ERROR_MESSAGE

const hasEnumerableListingsPayload = (payload = {}) =>
  Array.isArray(payload?.reqDetailsBOList)

const assertVerifiedCareersSurface = (html = '') => {
  if (hasVerifiedCareersSurface(html)) return

  throw new Error(
    'Yulu verified careers shell no longer matches the first-party MyNextHire handoff contract.',
  )
}

const assertVerifiedListingsState = (payload = {}) => {
  if (hasEnumerableListingsPayload(payload)) return
  if (hasExpectedListingsError(payload)) return

  throw new Error(
    'Yulu public MyNextHire requisition contract changed materially; review the unexpected public listing response before promoting a parser.',
  )
}

const defaultFetchHtml = (url) => fetchTextWithRetry(url, {
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': USER_AGENT,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent': USER_AGENT,
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

const formatEmploymentType = (value) => {
  const normalized = normalizeText(value)?.toLowerCase()
  if (!normalized) return null

  const mapped = {
    'full-time': 'Full-time',
    fulltime: 'Full-time',
    contract: 'Contract',
    intern: 'Internship',
  }

  return mapped[normalized] || normalized[0].toUpperCase() + normalized.slice(1)
}

const formatExperienceRange = (minYears, maxYears) => {
  const min = Number(minYears)
  const max = Number(maxYears)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  if (min <= 0 && max <= 0) return null
  return `${min}-${max} years`
}

const normalizePostingDate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const parsed = Date.parse(normalized)
  if (!Number.isFinite(parsed)) return normalized

  return new Date(parsed).toISOString()
}

const buildMynextHireLink = (baseUrl, reqId, pageType) => {
  const encodedContext = Buffer
    .from(JSON.stringify({
      pageType,
      cvSource: 'careers',
      reqId: Number.parseInt(String(reqId), 10),
      requester: {
        id: '',
        code: '',
        name: '',
      },
      page: 'careers',
      bufilter: -1,
      customFields: {},
    }), 'utf8')
    .toString('base64')

  return `${baseUrl}?src${encodeURIComponent('=')}careers${encodeURIComponent('&')}p${encodeURIComponent('=')}${encodedContext}`
}

const formatLocation = (record = {}) => {
  const city = normalizeText(record.location)
  if (!city) return { location: null, city: null }

  return {
    location: /\bindia\b/i.test(city) ? city : `${city}, India`,
    city: city.replace(/,\s*India$/i, '') || null,
  }
}

export const buildJobUrl = (reqId) => buildMynextHireLink(JOBS_BOARD_URL, reqId, 'jd')
export const buildApplyUrl = (reqId) => buildMynextHireLink(`${JOBS_BOARD_URL}/apply`, reqId, 'application')

export const extractJobs = (payload = {}) => {
  const records = Array.isArray(payload?.reqDetailsBOList) ? payload.reqDetailsBOList : []

  return records
    .map((record) => {
      const reqId = normalizeText(record.reqId)
      const title = normalizeText(record.reqTitle)
      const { location, city } = formatLocation(record)

      if (!reqId || !title || !location) return null

      return {
        title,
        company: COMPANY,
        department: normalizeText(record.buName) || normalizeText(record.careerStream),
        location,
        city,
        country: 'India',
        jobId: reqId,
        requisitionId: reqId,
        sourceUrl: buildJobUrl(reqId),
        applyUrl: buildApplyUrl(reqId),
        employmentType: formatEmploymentType(record.employmentType),
        experienceRequired: formatExperienceRange(record.expMin, record.expMax),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizePostingDate(record.approvedOn),
        closingDate: null,
        jobDescription: normalizeText(record.jdDisplay) || null,
        remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)
}

export const createYuluScraper = ({
  careersUrl = CAREERS_URL,
  requisitionListUrl = REQUISITION_LIST_URL,
} = {}) => ({
  async run({ fetchHtml = defaultFetchHtml, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchHtml(careersUrl)
    assertVerifiedCareersSurface(careersHtml)

    const listingsPayload = await fetchJson(requisitionListUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildListingsRequestBody()),
    })

    assertVerifiedListingsState(listingsPayload)
    const jobs = extractJobs(listingsPayload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createYuluScraper().run(options)

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
