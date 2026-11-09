import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import DREMIO_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DREMIO_CATALOG
export const SOURCE = DREMIO_CATALOG.source
export const COMPANY = DREMIO_CATALOG.companyName
export const CAREERS_LANDING_URL = DREMIO_CATALOG.officialCareersLandingUrl
export const JOB_POSTINGS_URL = DREMIO_CATALOG.companyCareerPage
export const GREENHOUSE_EMBED_SCRIPT_URL = DREMIO_CATALOG.greenhouseEmbedScriptUrl
export const GREENHOUSE_JOBS_API_URL = DREMIO_CATALOG.greenhouseJobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current.replace(/\u00a0/g, ' ').trim()
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: JOB_POSTINGS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const deriveCity = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation || /^remote$/i.test(normalizedLocation)) return null
  if (!normalizedLocation.includes(',')) return null

  return normalizeWhitespace(normalizedLocation.split(',')[0])
}

const inferCountry = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation || /^remote$/i.test(normalizedLocation)) return null
  if (!normalizedLocation.includes(',')) return normalizedLocation

  return normalizeWhitespace(normalizedLocation.split(',').at(-1))
}

const inferRemoteStatus = ({ location, description }) => {
  const haystack = [location, description].filter(Boolean).join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack) || /#LI-remote/i.test(haystack)) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (description) => {
  const normalizedDescription = normalizeWhitespace(description)
  if (!normalizedDescription) return null

  const rangeMatch = normalizedDescription.match(/\b(\d+\s*-\s*\d+\s*years?)\s+of\s+experience\b/i)
  if (rangeMatch) return normalizeWhitespace(rangeMatch[1])?.toLowerCase()

  const plusMatch = normalizedDescription.match(/\b(\d+\+\s*years?)\s+of\s+experience\b/i)
  if (plusMatch) return normalizeWhitespace(plusMatch[1])?.toLowerCase()

  return null
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersLandingSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Join the Dremio Team \| Career Opportunities \| Dremio\s*<\/title>/i.test(page)
    && /The next wave of data analytics is here/i.test(page)
    && /Search Jobs/i.test(page)
    && /Open Roles/i.test(page)
}

export const hasOfficialJobPostingsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Job Postings \| Career Opportunities \| Dremio\s*<\/title>/i.test(page)
    && (
      (
        /<script[^>]+src=["']https:\/\/boards\.greenhouse\.io\/embed\/job_board\/js\?for=dremio["']/i.test(page)
        && /gh_jid=/i.test(page)
      )
      || (
        /Dremio is now part of SAP/i.test(page)
        && /Working at Dremio/i.test(page)
        && /Open Roles/i.test(page)
      )
    )
}

export const hasCloudflareBlockSignal = (page = {}) => {
  const html = String(page?.html ?? '')

  return Number(page?.status) === 403
    && /<title>\s*Attention Required!\s*\|\s*Cloudflare\s*<\/title>/i.test(html)
    && /Please enable cookies\./i.test(html)
    && /Sorry,\s*you have been blocked/i.test(html)
    && /unable to access/i.test(html)
}

export const extractJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Dremio Greenhouse jobs payload no longer exposes the expected jobs array')
  }

  return jobs.map((job) => {
    const title = normalizeWhitespace(job?.title)
    const location = normalizeWhitespace(job?.location?.name)
    const sourceUrl = normalizeWhitespace(job?.absolute_url)
    const companyName = normalizeWhitespace(job?.company_name)
    const description = stripTags(decodeRepeatedHtmlEntities(job?.content))

    if (!title || !location || !sourceUrl) {
      throw new Error('Dremio Greenhouse jobs payload no longer matches the verified job contract')
    }

    if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
      throw new Error('Dremio Greenhouse jobs payload no longer maps to the verified company identity')
    }

    return {
      title,
      company: COMPANY,
      location,
      city: deriveCity(location),
      country: inferCountry(location),
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId: job?.id ?? null,
      requisitionId: normalizeWhitespace(job?.requisition_id),
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      employmentType: null,
      experienceRequired: extractExperienceRequired(description),
      postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
      jobDescription: description,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: inferRemoteStatus({
        location,
        description,
      }),
      scrapedAt,
    }
  })
}

export const createDremioScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersLandingPage = await fetchPage(CAREERS_LANDING_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingPage.html) && !hasCloudflareBlockSignal(careersLandingPage)) {
      throw new Error('Dremio verified Dremio careers landing page no longer matches the official first-party surface')
    }

    const jobPostingsPage = await fetchPage(JOB_POSTINGS_URL)
    if (!hasOfficialJobPostingsSignal(jobPostingsPage.html) && !hasCloudflareBlockSignal(jobPostingsPage)) {
      throw new Error('Dremio verified Dremio job postings page no longer matches the official first-party surface')
    }

    const jobs = extractJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createDremioScraper(options).run(options)

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
