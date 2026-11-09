import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import PINTEREST_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PINTEREST_CATALOG.source
export const COMPANY = PINTEREST_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PINTEREST_CATALOG.officialBrandName
export const VERIFIED_ON = PINTEREST_CATALOG.verifiedOn
export const PROVIDER_METADATA = PINTEREST_CATALOG
export const CAREERS_PAGE_URL = PINTEREST_CATALOG.companyCareerPage
export const GREENHOUSE_JOBS_API_URL = PINTEREST_CATALOG.greenhouseJobsApiUrl
export const OFFICIAL_JOB_URL_PREFIX = PINTEREST_CATALOG.officialJobUrlPrefix

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&'),
)?.toLowerCase() || ''

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

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Explore career opportunities at Pinterest \| Pinterest Careers\s*<\/title>/i.test(page)
    && normalized.includes('explore career opportunities at pinterest')
    && normalized.includes('filter jobs')
    && normalized.includes('displaying 1 to 20')
}

export const isCloudflareInterstitial = (html = '') => {
  const normalized = normalizeText(html)
  return normalized.includes('just a moment')
    && normalized.includes('enable javascript and cookies to continue')
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  return /\bIndia\b/i.test(normalized)
    || /(?:^|[;,]\s*|-\s*)Remote,\s*IN$/i.test(normalized)
    || /(?:^|[;,]\s*)[^,;]+,\s*IN$/i.test(normalized)
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^remote\b/i.test(normalized)) return null
  return normalized.split(/[;,]/)[0]?.trim() || null
}

const normalizeRemoteStatus = (location) => (
  /^remote\b/i.test(normalizeWhitespace(location) || '') ? 'Remote' : null
)

const normalizeGreenhouseJobUrl = (value, jobId) => {
  const normalizedId = normalizeWhitespace(jobId)
  if (!normalizedId) return null

  const normalizedUrl = normalizeWhitespace(value)
  if (!normalizedUrl) return null

  if (!new RegExp(`^${OFFICIAL_JOB_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d+$`, 'i').test(normalizedUrl)) {
    return null
  }

  return `${OFFICIAL_JOB_URL_PREFIX}${normalizedId}`
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Verified Pinterest Greenhouse payload changed materially')
  }

  return jobs
    .map((job) => {
      const companyName = normalizeWhitespace(job?.company_name)
      const title = normalizeWhitespace(job?.title)
      const location = normalizeWhitespace(job?.location?.name)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const jobId = normalizeWhitespace(job?.id)

      if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
        throw new Error('Verified Pinterest Greenhouse payload changed materially')
      }

      if (!title || !sourceUrl || !jobId) {
        throw new Error('Verified Pinterest Greenhouse payload changed materially')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        location,
        city: deriveCity(location),
        country: isIndiaLocation(location) ? 'India' : null,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        closingDate: null,
        jobDescription: decodeHtmlEntities(job?.content) || null,
        remoteStatus: normalizeRemoteStatus(location),
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
      }
    })
    .filter((job) => job.country === 'India')
}

export const createPinterestScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml) && !isCloudflareInterstitial(careersHtml)) {
      throw new Error('Verified official Pinterest careers page changed materially')
    }

    return extractIndiaJobsFromGreenhousePayload(
      await fetchJson(GREENHOUSE_JOBS_API_URL),
      { scrapedAt: now() },
    )
  },
})

export const run = async (options = {}) => createPinterestScraper(options).run(options)

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
