import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG from './catalog.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.source
export const COMPANY = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.companyName
export const PROVIDER_METADATA = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG
export const VERIFIED_ON = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.verifiedOn
export const CAREERS_LANDING_URL = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.careersLandingUrl
export const JOBS_PORTAL_URL = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.companyCareerPage
export const CEIPAL_WIDGET_URL = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalWidgetUrl
export const CEIPAL_WIDGET_SCRIPT_URL = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalWidgetScriptUrl
export const CEIPAL_API_KEY = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalApiKey
export const CEIPAL_CAREER_PORTAL_ID = SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalCareerPortalId
export const CEIPAL_JOB_POSTINGS_API_BASE_URL =
  SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalJobPostingsApiBaseUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: `${SOURCE}-html`,
    timeoutMs: 15000,
  })

const defaultFetchJson = (url, options = {}) =>
  fetchJsonWithRetry(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
    label: `${SOURCE}-json`,
    timeoutMs: 15000,
  })

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/\)\s*,\s*\(/g, '; ')
    .replace(/[()]/g, '')
    .replace(/\s*;\s*/g, '; ')
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  return normalized.split(';')[0]?.split(',')[0]?.trim() || normalized
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/contract/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const parsePortalDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const monthDayYear = normalized.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/)
  if (monthDayYear) {
    const [, month, day, year] = monthDayYear
    const normalizedYear = year.length === 2 ? `20${year}` : year
    return `${normalizedYear}-${month}-${day}`
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const normalizeRemoteStatus = (value) => {
  if (value === 1 || value === '1') return 'Remote'
  if (value === 2 || value === '2') return 'Hybrid'
  return 'On-site'
}

const getCareerPortalApplyUrl = (job) => normalizeWhitespace(
  job?.apply_job_monster
  ?? job?.apply_job
  ?? job?.campus_portal_login_url
  ?? job?.campus_portal_job_details_url
  ?? null,
)

const getCareerPortalSourceUrl = (job) => normalizeWhitespace(
  job?.campus_portal_job_details_url
  ?? job?.apply_job_monster
  ?? job?.apply_job
  ?? job?.campus_portal_login_url
  ?? null,
)

const getCareerPortalEmploymentType = (job) => normalizeEmploymentType(
  job?.pay_rates?.find?.((rate) => normalizeWhitespace(rate?.pay_rate_employment_type))?.pay_rate_employment_type
  ?? job?.tax_terms
  ?? null,
)

const buildLocation = (job) => {
  const explicit = normalizeLocation(job?.multpile_job_location)
  if (explicit) return explicit

  const fallback = [
    normalizeWhitespace(job?.city),
    normalizeWhitespace(job?.state),
    normalizeWhitespace(job?.country),
  ].filter(Boolean)

  return fallback.join(', ') || null
}

const buildApiHeaders = ({ widgetUrl } = {}) => ({
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Origin: 'https://jobsapi.ceipal.com',
  Referer: widgetUrl,
  'User-Agent': USER_AGENT,
  'X-Requested-With': 'XMLHttpRequest',
})

export const buildWidgetUrl = ({ apiKey, careerPortalId } = {}) =>
  `https://jobsapi.ceipal.com/APISource/v2/index.html?api_key=${apiKey}&cp_id=${careerPortalId}`

export const buildJobPostingsApiUrl = ({ page = 1 } = {}) =>
  `${CEIPAL_JOB_POSTINGS_API_BASE_URL}?page=${page}`

export const buildJobPostingsPayload = ({ apiKey, careerPortalId, page = 1 } = {}) =>
  new URLSearchParams({
    page: String(page),
    api_key: String(apiKey ?? ''),
    method: 'CareerPortalJobPostings',
    cp_id: String(careerPortalId ?? ''),
    from_career_portal: '1',
  })

export const hasVerifiedCareersLandingSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Solugenix Careers')
    && normalized.includes('All Openings')
    && normalized.includes('Refer a Candidate')
    && normalized.includes('India')
}

export const hasVerifiedJobsPortalSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return normalized.includes('Jobs Portal')
    && rawHtml.includes(CEIPAL_WIDGET_SCRIPT_URL)
    && rawHtml.includes(`data-ceipal-api-key="${CEIPAL_API_KEY}"`)
    && rawHtml.includes(`data-ceipal-career-portal-id="${CEIPAL_CAREER_PORTAL_ID}"`)
}

export const extractWidgetConfig = (html) => {
  const scriptTag = String(html ?? '').match(
    /<script\b[^>]*src=["']https:\/\/jobsapi\.ceipal\.com\/APISource\/widget\.js["'][^>]*><\/script>/i,
  )?.[0]

  if (!scriptTag) return null

  const apiKey = normalizeWhitespace(
    scriptTag.match(/\bdata-ceipal-api-key=["']([^"']+)["']/i)?.[1] ?? null,
  )
  const careerPortalId = normalizeWhitespace(
    scriptTag.match(/\bdata-ceipal-career-portal-id=["']([^"']+)["']/i)?.[1] ?? null,
  )

  if (!apiKey || !careerPortalId) return null

  return { apiKey, careerPortalId }
}

export const hasWidgetSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('CEIPAL Career Portal')
    && normalized.includes('Search Jobs')
    && normalized.includes('Current Openings')
}

export const hasCareerPortalResponseSignal = (payload) => {
  if (!payload || typeof payload !== 'object') return false

  const count = Number(payload.count)
  const numPages = Number(payload.num_pages)
  const pageNumber = Number(payload.page_number)

  return Number.isFinite(count)
    && Number.isFinite(numPages)
    && Number.isFinite(pageNumber)
    && Array.isArray(payload.results)
}

export const extractIndiaJobsFromJobPostingsPayload = (payload = {}) => {
  if (!hasCareerPortalResponseSignal(payload)) {
    throw new Error('Solugenix CEIPAL API no longer exposes the verified CareerPortalJobPostings response shape')
  }

  return payload.results
    .map((job) => {
      const title = normalizeWhitespace(job?.public_job_title ?? job?.position_title)
      const country = normalizeWhitespace(job?.country)
      const location = buildLocation(job)
      const sourceUrl = getCareerPortalSourceUrl(job)
      const applyUrl = getCareerPortalApplyUrl(job)
      const jobId = normalizeWhitespace(job?.job_id ?? job?.id)
      const requisitionId = normalizeWhitespace(job?.job_code ?? job?.job_id ?? job?.id)

      if (!title || !country || !/india/i.test(country) || !location || !sourceUrl || !applyUrl || !jobId) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city: extractCity(location),
        state: normalizeWhitespace(job?.state),
        country: 'India',
        jobId,
        requisitionId,
        sourceUrl,
        applyUrl,
        employmentType: getCareerPortalEmploymentType(job),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: parsePortalDate(job?.created ?? job?.modified),
        closingDate: parsePortalDate(job?.closing_date),
        jobDescription: normalizeWhitespace(job?.public_job_desc ?? job?.requistion_description),
        workplaceType: normalizeRemoteStatus(job?.remote_opportunities),
      }
    })
    .filter(Boolean)
}

export const createSolugenixIndiaPrivateLimitedScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    maxPages = 20,
  } = {}) {
    const careersLandingHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasVerifiedCareersLandingSignal(careersLandingHtml)) {
      throw new Error('Response is not the verified Solugenix careers landing page')
    }

    const jobsPortalHtml = await fetchText(JOBS_PORTAL_URL)
    if (!hasVerifiedJobsPortalSignal(jobsPortalHtml)) {
      throw new Error('Response is not the verified Solugenix jobs portal')
    }

    const widgetConfig = extractWidgetConfig(jobsPortalHtml)
    if (
      !widgetConfig
      || widgetConfig.apiKey !== CEIPAL_API_KEY
      || widgetConfig.careerPortalId !== CEIPAL_CAREER_PORTAL_ID
      || buildWidgetUrl(widgetConfig) !== CEIPAL_WIDGET_URL
    ) {
      throw new Error('Solugenix CEIPAL widget configuration changed materially')
    }

    const widgetHtml = await fetchText(CEIPAL_WIDGET_URL)
    if (!hasWidgetSignal(widgetHtml)) {
      throw new Error('Solugenix public CEIPAL widget shell changed materially')
    }

    const scrapedAt = now()
    const jobs = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages && page <= maxPages) {
      const payload = await fetchJson(buildJobPostingsApiUrl({ page }), {
        method: 'POST',
        headers: buildApiHeaders({ widgetUrl: CEIPAL_WIDGET_URL }),
        body: buildJobPostingsPayload({
          apiKey: CEIPAL_API_KEY,
          careerPortalId: CEIPAL_CAREER_PORTAL_ID,
          page,
        }),
      })

      if (!hasCareerPortalResponseSignal(payload)) {
        throw new Error('Response is not the verified public Solugenix CEIPAL career portal API')
      }

      jobs.push(...extractIndiaJobsFromJobPostingsPayload(payload).map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
        companyCareerPage: JOBS_PORTAL_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      })))

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs.slice(0, maxJobs)
      }

      const advertisedPages = Number.parseInt(String(payload.num_pages ?? '1'), 10)
      totalPages = Number.isFinite(advertisedPages) && advertisedPages > 0 ? advertisedPages : page
      if (!payload.next || page >= totalPages) break

      page += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createSolugenixIndiaPrivateLimitedScraper().run(options)

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
