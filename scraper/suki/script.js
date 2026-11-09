import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals, fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import SUKI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const PUBLIC_JOB_PATTERNS = [
  /\bopen positions @ suki\b/i,
  /\bapply\b/i,
  /gh_jid=\d+/i,
  /weekdayJdUid=/i,
]

export const PROVIDER_METADATA = SUKI_CATALOG
export const SOURCE = SUKI_CATALOG.source
export const COMPANY = SUKI_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SUKI_CATALOG.officialBrandName
export const VERIFIED_ON = SUKI_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SUKI_CATALOG.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = SUKI_CATALOG.officialCareersPageUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = SUKI_CATALOG.officialCareersHandoffUrl
export const GREENHOUSE_JOBS_API_URL = SUKI_CATALOG.greenhouseJobsApiUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: composeAbortSignals(signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    Referer: OFFICIAL_CAREERS_HANDOFF_URL,
  },
  label: `${SOURCE}-greenhouse`,
  timeoutMs: FETCH_TIMEOUT_MS,
  signal,
})

export const extractOpenPositionsHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/www\.suki\.ai\/open-positions\/?/i)
  if (!match?.[0]) return null
  return match[0].endsWith('/') ? match[0] : `${match[0]}/`
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Help shape the future of healthcare with AI')
    && normalized.includes('Join the Team')
    && normalized.includes('Level-up your career by applying to opportunities at Suki.')
    && normalized.includes('Suki AI, Inc.')
    && extractOpenPositionsHandoffUrl(html) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const hasVerifiedGreenhouseShell = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /open positions at suki \| healthcare ai jobs/i.test(String(html ?? ''))
    && normalized.includes('Current Openings')
    && normalized.includes('Company')
    && normalized.includes('Careers')
    && normalized.includes('Policies')
    && normalized.includes('Trust Portal')
    && /id=["']grnhse_app["']/i.test(String(html ?? ''))
}

const decodeHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const isExplicitIndiaLocation = (value) => /(?:^|[,\s])India(?:$|[,\s])/i.test(
  normalizeWhitespace(value) || '',
)

const isSukiIndiaOffice = (office) =>
  normalizeWhitespace(office?.name)?.toLowerCase() === 'suki india'

const isVerifiedForeignOffice = (office) => {
  const name = normalizeWhitespace(office?.name)?.toLowerCase()
  const location = normalizeWhitespace(office?.location) || ''

  if (name === 'suki hq') {
    return /\bRedwood City\b/i.test(location) && /(?:\bCA\b|\bCalifornia\b)/i.test(location)
  }

  return name === 'suki us remote' && /\bUnited States\b/i.test(location)
}

const classifyJobScope = ({ primaryLocation, offices }) => {
  if (isExplicitIndiaLocation(primaryLocation) || offices.some(isSukiIndiaOffice)) return 'india'
  if (offices.some(isVerifiedForeignOffice)) return 'foreign'
  return null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^(?:India|Remote)$/i.test(normalized)) return null
  return normalizeWhitespace(normalized.split(',')[0])
}

const normalizeJobUrl = (value, jobId) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  if (!normalizedJobId) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'www.suki.ai') return null
    if (url.pathname.replace(/\/+$/, '') !== '/open-positions') return null
    if (url.searchParams.get('gh_jid') !== normalizedJobId) return null
    return `${OFFICIAL_CAREERS_HANDOFF_URL.replace(/\/$/, '')}?gh_jid=${encodeURIComponent(normalizedJobId)}`
  } catch {
    return null
  }
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  if (!Array.isArray(payload?.jobs) || !Number.isInteger(payload?.meta?.total)) {
    throw new Error('Suki Greenhouse jobs API no longer exposes the expected complete payload')
  }

  if (payload.meta.total !== payload.jobs.length) {
    throw new Error('Suki Greenhouse jobs API total no longer matches the returned jobs')
  }

  const jobsById = new Map()

  for (const job of payload.jobs) {
    const primaryLocation = normalizeWhitespace(job?.location?.name)
    const jobId = normalizeWhitespace(job?.id)
    const title = normalizeWhitespace(job?.title)
    const sourceUrl = normalizeJobUrl(job?.absolute_url, jobId)
    const companyName = normalizeWhitespace(job?.company_name)

    if (companyName?.toLowerCase() !== COMPANY.toLowerCase()) {
      throw new Error('Suki Greenhouse jobs API no longer maps to the verified company identity')
    }

    if (!jobId || !title || !primaryLocation || !sourceUrl || !Array.isArray(job?.offices)) {
      throw new Error('Suki Greenhouse job no longer exposes the verified public job contract')
    }

    const scope = classifyJobScope({ primaryLocation, offices: job.offices })
    if (!scope) {
      throw new Error('Suki Greenhouse job does not establish India or verified foreign location scope')
    }

    if (jobsById.has(jobId) || scope === 'foreign') continue

    jobsById.set(jobId, {
      title,
      company: COMPANY,
      location: primaryLocation,
      city: deriveCity(primaryLocation),
      state: null,
      country: 'India',
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      jobCategory: normalizeWhitespace(job?.departments?.[0]?.name),
      jobId,
      requisitionId: normalizeWhitespace(job?.requisition_id),
      sourceUrl,
      applyUrl: sourceUrl,
      link: sourceUrl,
      source: SOURCE,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job?.first_published || job?.updated_at),
      closingDate: normalizeWhitespace(job?.application_deadline),
      jobDescription: decodeHtml(job?.content),
      remoteStatus: /\bremote\b/i.test(primaryLocation) ? 'Remote' : null,
      scrapedAt,
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: SUKI_CATALOG.companyDomain,
      atsPlatform: SUKI_CATALOG.atsPlatform,
    })
  }

  return [...jobsById.values()]
}

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw signal.reason || new DOMException('The operation was aborted', 'AbortError')
  }
}

export const createSukiScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    throwIfAborted(signal)
    const careersPage = await fetchPage(CAREERS_PAGE_URL, { signal })
    throwIfAborted(signal)

    if (
      Number(careersPage?.status) !== 200
      || !matchesExpectedUrl(careersPage?.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersSignal(careersPage?.html)
    ) {
      throw new Error('The verified Suki careers page changed materially')
    }

    if (extractOpenPositionsHandoffUrl(careersPage?.html) !== OFFICIAL_CAREERS_HANDOFF_URL) {
      throw new Error('The verified Suki open positions handoff changed materially')
    }

    const handoffPage = await fetchPage(OFFICIAL_CAREERS_HANDOFF_URL, { signal })
    throwIfAborted(signal)

    if (
      Number(handoffPage?.status) !== 200
      || !matchesExpectedUrl(handoffPage?.url, OFFICIAL_CAREERS_HANDOFF_URL)
      || !hasVerifiedGreenhouseShell(handoffPage?.html)
    ) {
      throw new Error('The verified Suki open positions surface changed materially')
    }

    const payload = await fetchJson(GREENHOUSE_JOBS_API_URL, { signal })
    throwIfAborted(signal)

    return extractIndiaJobsFromGreenhousePayload(payload, { scrapedAt: now() })
  },
})

export const run = async (options = {}) => createSukiScraper().run(options)

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
