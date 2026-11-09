import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FINBOX_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FINBOX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.careersPageUrl
export const JOBS_EMBED_URL = PROVIDER_METADATA.jobsEmbedUrl
export const JOBS_BOARD_URL = JOBS_EMBED_URL.replace(/\/job-embed$/, '')
export const COMPANY_DETAILS_API_URL = PROVIDER_METADATA.companyDetailsApiUrl
export const REQUISITIONS_API_URL = PROVIDER_METADATA.requisitionsApiUrl

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

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const stripHtml = (value) => normalizeWhitespace(value)

const formatExperienceRange = (range = []) => {
  if (!Array.isArray(range) || range.length === 0) return null

  const [minimum, maximum] = range
    .map((value) => Number.parseInt(String(value ?? ''), 10))
    .filter(Number.isFinite)

  if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
    return minimum === maximum ? `${minimum} years` : `${minimum}-${maximum} years`
  }

  if (Number.isFinite(minimum)) {
    return `${minimum}+ years`
  }

  return null
}

const extractPrimaryLocation = (locations = []) => {
  const primaryLocation = Array.isArray(locations) ? locations[0] : null
  const city = firstNonEmpty(primaryLocation?.city)
  const country = firstNonEmpty(primaryLocation?.country)
  const location = [city, country].filter(Boolean).join(', ') || null

  return {
    location,
    city,
    country,
  }
}

export const buildJobDetailUrl = (slug) => (
  slug ? `https://jobs.reczee.com/finbox/${encodeURIComponent(slug)}` : null
)

export const buildJobApplyUrl = (slug) => (
  slug ? `https://jobs.reczee.com/finbox/${encodeURIComponent(slug)}/apply` : null
)

export const extractJobsEmbedUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (match[1] === JOBS_EMBED_URL) return match[1]
  }

  return null
}

export const hasVerifiedCareersShell = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*FinBox\s*<\/title>/i.test(rawHtml)
    && /<meta name="description" content="Powering modern credit with a suite of infrastructure, risk intelligence and orchestration solutions\."/i.test(rawHtml)
  }

export const hasVerifiedJobsEmbedShell = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<meta name="title" content="Jobs at FinBox"/i.test(rawHtml)
    && /<meta name="description" content="Come join our awesome team at FinBox!"/i.test(rawHtml)
  }

export const isVerifiedCompanyDetailsPayload = (payload = {}) => {
  const company = payload?.data?.company
  const companyName = firstNonEmpty(company?.name)
  const companySlug = firstNonEmpty(company?.slug)
  const websiteUrl = firstNonEmpty(company?.website_url)

  return companyName === COMPANY
    && companySlug === 'finbox'
    && Boolean(company?.careers_page_active)
    && /^https:\/\/finbox\.in\/?$/i.test(websiteUrl || '')
}

export const extractRequisitions = (payload = {}) => (
  Array.isArray(payload?.data?.requisitions) ? payload.data.requisitions : []
)

const hasVerifiedRequisitionsPayload = (payload = {}) => (
  firstNonEmpty(payload?.data?.company) === COMPANY
  && Array.isArray(payload?.data?.requisitions)
)

export const normalizeRequisition = (requisition = {}) => {
  const title = firstNonEmpty(requisition.title, requisition.designation)
  const companyName = firstNonEmpty(requisition.company?.name, COMPANY)
  const department = firstNonEmpty(requisition.department?.title)
  const slug = firstNonEmpty(requisition.slug)
  const jobId = firstNonEmpty(requisition.id)
  const { location, city, country } = extractPrimaryLocation(requisition.locations)
  const sourceUrl = buildJobDetailUrl(slug)
  const applyUrl = buildJobApplyUrl(slug)

  if (
    companyName !== COMPANY
    || !title
    || !slug
    || !jobId
    || !sourceUrl
    || !applyUrl
    || requisition.open_for_careers_page !== true
  ) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department,
    location,
    city,
    country,
    jobId: String(jobId),
    requisitionId: slug,
    sourceUrl,
    applyUrl,
    employmentType: firstNonEmpty(requisition.job_type_display, requisition.job_type),
    experienceRequired: formatExperienceRange(requisition.experience_range),
    postingDate: firstNonEmpty(requisition.posted_on),
    jobDescription: stripHtml(requisition.job_description),
  }
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
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFinBoxScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasVerifiedCareersShell(careersHtml)) {
      throw new Error('FinBox verified first-party careers handoff no longer matches the public Reczee embed surface')
    }

    const jobsEmbedHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasVerifiedJobsEmbedShell(jobsEmbedHtml)) {
      throw new Error('FinBox verified Reczee embed shell no longer matches the public careers surface')
    }

    const companyDetailsPayload = await fetchJson(COMPANY_DETAILS_API_URL)
    if (!isVerifiedCompanyDetailsPayload(companyDetailsPayload)) {
      throw new Error('FinBox verified Reczee company details no longer match the public careers surface')
    }

    const requisitionsPayload = await fetchJson(REQUISITIONS_API_URL)
    if (!hasVerifiedRequisitionsPayload(requisitionsPayload)) {
      throw new Error('FinBox verified requisitions feed no longer matches the pinned public company contract')
    }

    const jobs = []

    for (const requisition of extractRequisitions(requisitionsPayload)) {
      const normalizedJob = normalizeRequisition(requisition)
      if (!normalizedJob) {
        throw new Error('FinBox verified requisitions feed no longer matches the pinned public job contract')
      }

      jobs.push({
        ...normalizedJob,
        source: SOURCE,
        link: normalizedJob.applyUrl || normalizedJob.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createFinBoxScraper().run(options)

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
