import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { ONECARD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = ONECARD_CATALOG
export const SOURCE = ONECARD_CATALOG.source
export const COMPANY = ONECARD_CATALOG.companyName
export const OFFICIAL_CAREERS_URL = ONECARD_CATALOG.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = ONECARD_CATALOG.officialCareersHandoffUrl
export const OFFICIAL_JOBS_API_URL = ONECARD_CATALOG.officialJobsApiUrl
export const OFFICIAL_JOBS_API_KEY = ONECARD_CATALOG.officialJobsApiKey
export const OFFICIAL_APPLY_URL = ONECARD_CATALOG.officialApplyUrl
export const VERIFIED_AT = ONECARD_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ONECARD_CATALOG.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const BROKEN_UPSTREAM_API_URL = 'https://paa.fplabs.tech/proxy/CRUD/api/test-jobs?populate=*'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null)

const parseJsonText = (body) => {
  try {
    return JSON.parse(String(body ?? ''))
  } catch {
    return null
  }
}

const buildMaterialSurfaceChangeError = () => {
  const error = new Error('The verified OneCard careers surfaces changed materially')
  error.abortRetries = true
  return error
}

export const extractOfficialHandoffUrl = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(/href=["'](https:\/\/www\.fplabs\.tech\/careers\/)["']/i)?.[1] ?? null,
  )

export const extractOfficialApplyUrl = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(/href=["'](mailto:careers@getonecard\.app)["']/i)?.[1] ?? null,
  )

export const extractOfficialJobsApiConfig = (html) => {
  const match = String(html ?? '').match(
    /fetch\(\s*"([^"]+\/hr\/jobs)"[\s\S]*?"x-api-key":\s*"([^"]+)"/i,
  )

  const jobsApiUrl = normalizeWhitespace(match?.[1] ?? null)
  const jobsApiKey = normalizeWhitespace(match?.[2] ?? null)

  if (!jobsApiUrl || !jobsApiKey) {
    return null
  }

  return { jobsApiUrl, jobsApiKey }
}

export const hasOfficialOneCardCareersSignals = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = (normalizeWhitespace(rawHtml) || '').toLowerCase()
  const apiConfig = extractOfficialJobsApiConfig(rawHtml)

  return extractTitle(rawHtml) === 'Careers at FPL'
    && normalized.includes('join team onecard')
    && normalized.includes('fintech revolution in india')
    && normalized.includes('work with us')
    && extractOfficialHandoffUrl(rawHtml) === OFFICIAL_CAREERS_HANDOFF_URL
    && extractOfficialApplyUrl(rawHtml) === OFFICIAL_APPLY_URL
    && apiConfig?.jobsApiUrl === OFFICIAL_JOBS_API_URL
    && apiConfig?.jobsApiKey === OFFICIAL_JOBS_API_KEY
}

export const hasVerifiedFplHandoffGateSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return extractTitle(rawHtml) === 'You are being redirected...'
    && normalized.includes('Javascript is required. Please enable javascript before you are allowed to see this page.')
    && /sucuri_cloudproxy_js/i.test(rawHtml)
}

export const hasVerifiedBrokenPublicJobsApiError = (status, body) => {
  const payload = parseJsonText(body)
  const message = normalizeWhitespace(
    typeof payload?.error === 'string'
      ? payload.error
      : payload?.error?.message,
  ) || ''

  return Number(status) === 500
    && payload?.success === false
    && message.includes(`invalid json response body at ${BROKEN_UPSTREAM_API_URL}`)
    && message.includes(`Unexpected token '<'`)
    && message.includes('is not valid JSON')
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const extractCity = (value) => normalizeWhitespace(String(value ?? '').split(',')[0] ?? null)

export const extractJobsFromPayload = (payload) => {
  const rows = payload?.data?.data
  if (!Array.isArray(rows)) {
    throw new Error('OneCard public jobs API no longer exposes the expected data array')
  }

  return rows
    .map((row) => {
      const title = normalizeWhitespace(row?.attributes?.title)
      const jobId = normalizeWhitespace(row?.id)
      if (!title || !jobId) return null

      const location = normalizeWhitespace(row?.attributes?.location) || 'Pune'

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: OFFICIAL_CAREERS_URL,
        applyUrl: OFFICIAL_APPLY_URL,
        employmentType: null,
        experienceRequired: normalizeWhitespace(row?.attributes?.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizePostingDate(row?.attributes?.publishedAt),
        closingDate: null,
        jobDescription: normalizeWhitespace(row?.attributes?.description),
      }
    })
    .filter(Boolean)
}

const defaultFetchPage = async (url, {
  accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  headers = {},
} = {}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: accept,
        ...headers,
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url,
      finalUrl: response.url,
      body: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    return {
      status: null,
      url,
      finalUrl: url,
      body: null,
      errorKind: error?.name === 'AbortError' ? 'timeout' : 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createOneCardScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const careersPage = await fetchPage(OFFICIAL_CAREERS_URL)

    if (careersPage.errorKind) {
      throw new Error(`Failed to fetch verified OneCard careers route: ${OFFICIAL_CAREERS_URL} (${careersPage.errorKind})`)
    }

    if (Number(careersPage.status) !== 200 || !hasOfficialOneCardCareersSignals(careersPage.body)) {
      throw buildMaterialSurfaceChangeError()
    }

    const apiConfig = extractOfficialJobsApiConfig(careersPage.body)
    if (!apiConfig) {
      throw buildMaterialSurfaceChangeError()
    }

    const handoffPage = await fetchPage(OFFICIAL_CAREERS_HANDOFF_URL)
    if (handoffPage.errorKind) {
      throw new Error(`Failed to fetch verified OneCard handoff route: ${OFFICIAL_CAREERS_HANDOFF_URL} (${handoffPage.errorKind})`)
    }

    if (Number(handoffPage.status) !== 307 || !hasVerifiedFplHandoffGateSignal(handoffPage.body)) {
      throw buildMaterialSurfaceChangeError()
    }

    const jobsApiPage = await fetchPage(apiConfig.jobsApiUrl, {
      accept: 'application/json,text/plain,*/*',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiConfig.jobsApiKey,
      },
    })

    if (jobsApiPage.errorKind) {
      throw new Error(`Failed to fetch verified OneCard public jobs API: ${apiConfig.jobsApiUrl} (${jobsApiPage.errorKind})`)
    }

    if (Number(jobsApiPage.status) === 200) {
      const payload = parseJsonText(jobsApiPage.body)
      if (!payload) {
        throw buildMaterialSurfaceChangeError()
      }

      const jobs = extractJobsFromPayload(payload)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
      const scrapedAt = now()

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.sourceUrl,
        scrapedAt,
      }))
    }

    if (hasVerifiedBrokenPublicJobsApiError(jobsApiPage.status, jobsApiPage.body)) {
      return []
    }

    throw buildMaterialSurfaceChangeError()
  },
})

export const run = async (options = {}) => createOneCardScraper().run(options)

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
