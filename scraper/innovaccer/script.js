import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { INNOVACCER_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INNOVACCER_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const JOBS_PAGE_URL = PROVIDER_METADATA.officialJobsPageUrl
export const WORKABLE_BOARD_URL = PROVIDER_METADATA.workableBoardUrl
export const JOBS_FEED_URL = PROVIDER_METADATA.jobsFeedUrl
export const WIDGET_API_URL = PROVIDER_METADATA.widgetApiUrl
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (/full[\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[\s-]?time/i.test(normalized)) return 'Part-time'
  if (/intern/i.test(normalized)) return 'Internship'
  if (/contract/i.test(normalized)) return 'Contract'
  return normalized
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) return null
  if (normalized === 'on_site' || normalized === 'onsite') return 'On-site'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  return null
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const isIndiaCountry = (value) => normalizeWhitespace(value).toLowerCase() === 'india'

const extractJobId = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (!/^https?:\/\//i.test(normalized)) return normalized.toUpperCase()

  const match = normalized.match(/\/j\/([A-Z0-9]+)(?:\/|$)/i)
  return match?.[1]?.toUpperCase() || null
}

const buildLocation = (job = {}) => {
  const city = normalizeOptionalValue(job.location?.city || job.city)
  const state = normalizeOptionalValue(job.location?.region || job.location?.state || job.state)
  const country = normalizeOptionalValue(job.location?.country || job.country)
  const parts = [city, state, country].filter(Boolean)

  return {
    location: parts.join(', ') || country || null,
    city,
    state,
    country,
  }
}

const normalizePostingDate = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const parseWidgetPayload = (payload) => {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
  }

  return payload ?? null
}

const extractWorkableJobIds = (html) => {
  const jobIds = new Set()
  const page = String(html ?? '')
  const patterns = [
    /https:\/\/apply\.workable\.com\/j\/([A-Z0-9]+)/gi,
    /https:\/\/apply\.workable\.com\/innovaccer-analytics\/j\/([A-Z0-9]+)/gi,
  ]

  for (const pattern of patterns) {
    for (const match of page.matchAll(pattern)) {
      const jobId = normalizeOptionalValue(match[1])
      if (jobId) jobIds.add(jobId.toUpperCase())
    }
  }

  return jobIds
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: 'innovaccer workable widget payload',
  timeoutMs: 15000,
})

export const hasOfficialCareersPageSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const finalUrl = normalizeUrl(getFinalUrl(page, CAREERS_PAGE_URL))
  const rawHtml = String(html ?? '')
  const hasVerifiedHero = /(?:build the future of healthcare,\s*together|transforming healthcare together for a better future)/i
    .test(rawHtml)
  const hasVerifiedCta = /view open (?:roles|positions)/i.test(rawHtml)

  return status === 200
    && finalUrl === normalizeUrl(CAREERS_PAGE_URL)
    && hasVerifiedHero
    && hasVerifiedCta
    && /\/careers\/jobs/i.test(rawHtml)
}

export const hasOfficialJobsPageSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const finalUrl = normalizeUrl(getFinalUrl(page, JOBS_PAGE_URL))
  const rawHtml = String(html ?? '')
  const workableJobIds = extractWorkableJobIds(rawHtml)

  return status === 200
    && finalUrl === normalizeUrl(JOBS_PAGE_URL)
    && /job openings/i.test(rawHtml)
    && /apply\.workable\.com/i.test(rawHtml)
    && workableJobIds.size > 0
}

export const hasWidgetApiSignal = (payload) => {
  const parsed = parseWidgetPayload(payload)

  return normalizeWhitespace(parsed?.name).toLowerCase() === 'innovaccer analytics'
    && Array.isArray(parsed?.jobs)
}

export const extractIndiaJobsFromWidget = (payload) => {
  const parsed = parseWidgetPayload(payload)
  if (!hasWidgetApiSignal(parsed)) {
    throw new Error('Innovaccer verified Workable widget payload no longer matches the trusted public surface')
  }

  return parsed.jobs
    .map((job) => {
      const jobId = extractJobId(job.shortcode || job.code || job.url || job.application_url)
      const locationBits = buildLocation(job)

      if (!jobId || !isIndiaCountry(locationBits.country)) return null

      return {
        title: normalizeWhitespace(job.title),
        company: COMPANY_NAME,
        department: normalizeOptionalValue(job.department),
        location: locationBits.location,
        city: locationBits.city,
        state: locationBits.state,
        country: locationBits.country,
        jobId,
        requisitionId: jobId,
        sourceUrl: normalizeOptionalValue(job.url) || `${WORKABLE_BOARD_URL}j/${jobId}`,
        applyUrl: normalizeOptionalValue(job.application_url) || `${WORKABLE_BOARD_URL}j/${jobId}/apply`,
        employmentType: normalizeEmploymentType(job.employment_type),
        experienceRequired: normalizeOptionalValue(job.experience),
        minimumQualification: normalizeOptionalValue(job.education),
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizePostingDate(job.published || job.published_on || job.created_at),
        closingDate: null,
        jobDescription: normalizeOptionalValue(job.description),
        remoteStatus: normalizeRemoteStatus(job.workplace || job.remote_type),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Innovaccer scraper')
  }

  return parsed.toISOString()
}

export const createInnovaccerScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const fetchJson = options.fetchJson || defaultFetchJson

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPage)) {
      throw new Error('The verified Innovaccer careers page no longer matches the trusted public surface')
    }

    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(jobsPage)) {
      throw new Error('The verified Innovaccer jobs page no longer matches the trusted public surface')
    }

    const widgetPayload = await fetchJson(WIDGET_API_URL)
    if (!hasWidgetApiSignal(widgetPayload)) {
      throw new Error('The verified Innovaccer Workable widget payload no longer matches the trusted public surface')
    }

    const jobsPageJobIds = extractWorkableJobIds(jobsPage.html)
    const jobs = extractIndiaJobsFromWidget(widgetPayload)
    if (jobs.length > 0 && jobsPageJobIds.size > 0) {
      const hasOverlap = jobs.some((job) => jobsPageJobIds.has(job.jobId))
      if (!hasOverlap) {
        throw new Error('Innovaccer verified jobs page no longer overlaps with the trusted Workable job surface')
      }
    }

    const limit = Number.isInteger(options.maxJobs) ? options.maxJobs : maxJobs
    const selectedJobs = limit ? jobs.slice(0, limit) : jobs
    const scrapedAt = normalizeScrapedAt((options.now || now)())

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createInnovaccerScraper().run(options)

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
