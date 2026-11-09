import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MSC_CATALOG } from './catalog.js'
import { hasMscCornerstoneHandoff, runMscCornerstone } from './cornerstone.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MSC_CATALOG.source
export const COMPANY = MSC_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MSC_CATALOG.officialBrandName
export const HOMEPAGE_URL = MSC_CATALOG.homepageUrl
export const CAREERS_URL = MSC_CATALOG.companyCareerPage
export const COMPANY_DOMAIN = MSC_CATALOG.companyDomain
export const VERIFIED_ON = MSC_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MSC_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = MSC_CATALOG
export const JOB_LOCATIONS_API_URL = new URL('/api/feature/Career/GetJobLocationsList', HOMEPAGE_URL).toString()
export const VACANCIES_API_URL = new URL('/api/feature/Career/GetJobVacanciesJobLocationId', HOMEPAGE_URL).toString()
export const TARGET_JOB_LOCATION_NAME = 'India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /teamtailor/i,
  /workable/i,
  /darwinbox/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const stripTagsToLines = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const normalizeUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeUrlList = (value, baseUrl = CAREERS_URL) => {
  const items = Array.isArray(value)
    ? value
    : value == null || value === ''
      ? []
      : [value]

  return items
    .map((item) => normalizeUrl(item, baseUrl))
    .filter(Boolean)
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSummaryHighlights = (html) => {
  const listItems = extractListItems(html)
  if (listItems.length) return listItems

  return stripTagsToLines(html)
    .filter((line) => /^[\u2022·-]/u.test(line) || /^o\s+/i.test(line))
    .map((line) => line.replace(/^[\u2022·-]\s*/u, '').replace(/^o\s+/i, '').trim())
    .filter(Boolean)
}

const normalizeJobId = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized ? normalized.replace(/[{}]/g, '') : null
}

const buildLocation = (office, country) => [office, country].filter(Boolean).join(', ') || null

export const buildCareerUrl = ({
  jobLocationName = TARGET_JOB_LOCATION_NAME,
  jobId = null,
} = {}) => {
  const url = new URL(CAREERS_URL)

  if (jobLocationName) {
    url.searchParams.set('jobs', jobLocationName)
  }

  if (jobId) {
    url.searchParams.set('job', jobId)
  }

  return url.toString()
}

export const buildVacanciesUrl = (jobLocationId) => {
  const url = new URL(VACANCIES_API_URL)
  url.searchParams.set('jobLocationId', jobLocationId)
  return url.toString()
}

export const hasVerifiedMscCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const markup = page.toLowerCase()

  return markup.includes('work with us - careers &amp; vacancies | msc')
    && markup.includes('careers at msc')
    && markup.includes('a world of opportunities')
    && markup.includes('explore our vacant positions')
    && markup.includes('data-api-url-job-locations="/api/feature/career/getjoblocationslist"')
    && markup.includes('data-api-url="/api/feature/career/getjobvacanciesjoblocationid"')
}

export const hasVerifiedMscAccessDeniedSignal = (html = '') => {
  const text = (normalizeWhitespace(html) || '').toLowerCase()

  return text.includes('access denied')
    && text.includes("you don't have permission to access")
    && text.includes('msc.com/en/careers')
}

export const hasInlineMscJobs = (payload = {}) =>
  Array.isArray(payload?.Jobs) && payload.Jobs.some((job) => normalizeWhitespace(job?.Description))

export const hasPublicMscJobSignals = (value = '') => {
  if (value && typeof value === 'object') {
    return hasInlineMscJobs(value)
      || Boolean(
        normalizeUrl(value.LinkedInUrl)
        || normalizeUrl(value.PulseUrl)
        || normalizeUrlList(value.LocalPlatformUrl).length,
      )
  }

  const page = String(value ?? '')
  const text = normalizeWhitespace(page) || ''

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(text))
}

export const isVerifiedEmptyIndiaResponse = (payload = {}) => {
  const locationName = normalizeWhitespace(payload?.JobLocationName)?.toLowerCase() || ''
  const message = normalizeWhitespace(payload?.Message)?.toLowerCase() || ''
  const jobs = Array.isArray(payload?.Jobs) ? payload.Jobs : null

  return locationName === TARGET_JOB_LOCATION_NAME.toLowerCase()
    && Array.isArray(jobs)
    && jobs.length === 0
    && message.includes('unfortunately, we do not have any vacancies published in this country right now')
}

export const extractMscJobs = (payload = {}, {
  jobLocationName = TARGET_JOB_LOCATION_NAME,
  now = () => new Date().toISOString(),
} = {}) => (Array.isArray(payload?.Jobs) ? payload.Jobs : [])
  .map((job) => {
    const title = normalizeWhitespace(job?.Description)
    if (!title) return null

    const office = normalizeWhitespace(job?.Office)
    const country = normalizeWhitespace(job?.Country) || jobLocationName
    const rawJobId = normalizeWhitespace(job?.ID)
    const jobId = normalizeJobId(rawJobId)
    const sourceUrl = buildCareerUrl({ jobLocationName, jobId: rawJobId || jobId })
    const applyUrl = normalizeUrl(job?.LocalPlatformLink)
      || normalizeUrl(job?.LinkedInLink)
      || normalizeUrl(job?.PulseLink)
      || sourceUrl

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(job?.Category),
      location: buildLocation(office, country),
      city: office || jobLocationName,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: extractSummaryHighlights(job?.Summary),
      postingDate: null,
      closingDate: null,
      jobDescription: stripTags(job?.Summary),
      remoteStatus: null,
      source: SOURCE,
      link: applyUrl || sourceUrl,
      scrapedAt: now(),
    }
  })
  .filter(Boolean)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'msc-careers-shell',
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: buildCareerUrl(),
    'X-Requested-With': 'XMLHttpRequest',
    ...options.headers,
  },
  label: 'msc-careers-api',
  timeoutMs: 15000,
})

const extractTargetJobLocationId = (locations, targetName = TARGET_JOB_LOCATION_NAME) => {
  const match = (Array.isArray(locations) ? locations : [])
    .find((location) => normalizeWhitespace(location?.Name)?.toLowerCase() === targetName.toLowerCase())

  const jobLocationId = normalizeWhitespace(match?.Id)
  if (!jobLocationId) {
    throw new Error(`MSC careers API no longer lists the target job location "${targetName}"`)
  }

  return jobLocationId
}

export const createMscScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal = null,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (hasMscCornerstoneHandoff(careersHtml)) {
      return runMscCornerstone({ fetchText, fetchJson, signal, now })
    }

    if (hasVerifiedMscAccessDeniedSignal(careersHtml)) {
      throw new Error('MSC public careers inventory is unavailable: access denied')
    }

    if (!hasVerifiedMscCareersSignal(careersHtml)) {
      throw new Error('MSC careers shell no longer matches the verified public careers app surface')
    }

    const jobLocations = await fetchJson(JOB_LOCATIONS_API_URL, { signal })
    signal?.throwIfAborted()
    const targetJobLocationId = extractTargetJobLocationId(jobLocations)
    const indiaVacancies = await fetchJson(buildVacanciesUrl(targetJobLocationId), { signal })
    signal?.throwIfAborted()

    if (hasInlineMscJobs(indiaVacancies)) {
      return extractMscJobs(indiaVacancies, { jobLocationName: TARGET_JOB_LOCATION_NAME, now })
    }

    if (isVerifiedEmptyIndiaResponse(indiaVacancies)) {
      return []
    }

    if (hasPublicMscJobSignals(indiaVacancies)) {
      throw new Error('MSC India vacancies response now exposes public jobs outside the verified inline empty-state contract')
    }

    throw new Error('MSC India vacancies response no longer matches the verified careers API contract')
  },
})

export const run = async (options = {}) => createMscScraper().run(options)

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
