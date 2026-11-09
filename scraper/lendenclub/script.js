import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lendenclub'
export const COMPANY = 'LenDenClub'
export const CAREERS_URL = 'https://careers.lendenclub.com/'
export const APPLY_NOW_URL = 'https://www.lendenclub.com/careers/apply-now/'
export const KEKA_CAREERS_URL = 'https://lendenclub.keka.com/careers/'
export const KEKA_ACTIVE_JOBS_API_URL = 'https://lendenclub.keka.com/careers/api/jobs/default/active'
export const KEKA_PORTAL_INFO_URL = 'https://lendenclub.keka.com/careers/api/organization/default/careerportalinfo'
export const VERIFIED_AT = '2026-10-03'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const getIndiaLocations = (locations = []) => (
  Array.isArray(locations) ? locations : []
)
  .filter((location) => (
    /^(?:IN|IND)$/i.test(String(location?.countryCode ?? '').trim())
    || /^India$/i.test(String(location?.countryName ?? '').trim())
  ))

const getKekaLocationName = (location = {}) => {
  const name = normalizeWhitespace(location.name)
  if (name) return name

  const city = normalizeWhitespace(location.city)
  if (city) return city

  const state = normalizeWhitespace(location.state)
  if (state) return state

  return null
}

const buildKekaLocation = (locations = []) => {
  const labels = []
  const seen = new Set()

  for (const location of getIndiaLocations(locations)) {
    const name = getKekaLocationName(location)
    if (!name) continue

    const label = `${name}, India`
    const key = label.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    labels.push(label)
  }

  return labels.join('; ') || null
}

const extractKekaCity = (locations = []) => {
  for (const location of getIndiaLocations(locations)) {
    const city = normalizeWhitespace(location.city) || normalizeWhitespace(location.name)
    if (city) return city
  }

  return null
}

const buildKekaJobUrl = (jobId) => toAbsoluteUrl(`jobdetails/${encodeURIComponent(jobId)}`, KEKA_CAREERS_URL)

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  if (/<title[^>]*>\s*LenDenClub\s*<\/title>/i.test(String(html ?? ''))
    && /Join A Moment, Advance Your Career/i.test(normalized)
    && /View Open Roles/i.test(normalized)
    && /href=["']https:\/\/lendenclub\.keka\.com\/careers\/["']/i.test(String(html ?? ''))) {
    return true
  }

  return /join us,\s+let['’]s change the way india does lending and borrowing!?/i.test(normalized)
    && /we invite you to join us in this mission!?/i.test(normalized)
    && /why join lendenclub\?/i.test(normalized)
    && /work hard,\s+party harder/i.test(normalized)
}

export const hasExpectedKekaPortalIdentity = (payload = {}) =>
  normalizeWhitespace(payload.name) === 'LenDenClub'
  && normalizeWhitespace(payload.shortName) === 'LenDenClub'
  && normalizeWhitespace(payload.careersPortalDomain) === 'lendenclub.keka.com'
  && normalizeWhitespace(payload.companyWebsite) === 'https://www.lendenclub.com/'

export const extractApplyNowUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl === APPLY_NOW_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasApplyNowPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /apply for a job/i.test(normalized)
    && /domain:\s*['"]https:\/\/lendenclub\.keka\.com\/careers\/['"]/i.test(page)
    && /targetContainer:\s*['"]#khembedjobs['"]/i.test(page)
    && /https:\/\/lendenclub\.keka\.com\/careers\/api\/embedjobs\/js\//i.test(page)
}

export const extractKekaJobs = (payload = [], { now = () => new Date().toISOString() } = {}) => {
  if (!Array.isArray(payload)) return []

  const scrapedAt = now()

  return payload
    .map((record) => {
      const jobId = normalizeWhitespace(record?.id)
      const title = normalizeWhitespace(record?.title)
      const sourceUrl = jobId ? buildKekaJobUrl(jobId) : null
      const indiaLocations = getIndiaLocations(record?.jobLocations)

      if (!jobId || !title || !sourceUrl || indiaLocations.length === 0) return null

      return {
        title: decodeHtmlEntities(title),
        company: COMPANY,
        department: normalizeWhitespace(record.departmentName),
        location: buildKekaLocation(record.jobLocations),
        city: extractKekaCity(record.jobLocations),
        country: 'India',
        jobId,
        requisitionId: normalizeWhitespace(record.jobNumber) || jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: normalizeWhitespace(record.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record.skillNames)
          ? record.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizeWhitespace(record.publishedOn),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.description || record.excerpt),
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
      }
    })
    .filter(Boolean)
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
    Referer: KEKA_CAREERS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createLenDenClubScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchPageText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const careersHtml = await fetchPageText(CAREERS_URL)

      if (!hasOfficialCareersSignal(careersHtml)
        || !/href=["']https:\/\/lendenclub\.keka\.com\/careers\/["']/i.test(careersHtml)) {
        throw new Error('LenDenClub verified first-party careers chain no longer matches the trusted Keka handoff')
      }

      const portalInfo = await fetchJson(KEKA_PORTAL_INFO_URL)
      if (!hasExpectedKekaPortalIdentity(portalInfo)) {
        throw new Error('LenDenClub Keka portal no longer matches the exact company identity')
      }

      const payload = await fetchJson(KEKA_ACTIVE_JOBS_API_URL)
      return extractKekaJobs(payload, { now })
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createLenDenClubScraper().run(options)

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
