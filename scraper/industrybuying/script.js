import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDUSTRY_BUYING_CATALOG } from './catalog.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INDUSTRY_BUYING_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const HOMEPAGE_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffPageUrl
export const JOBS_SITE_URL = PROVIDER_METADATA.officialJobsSiteUrl
export const JOBS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CAREER_API_BASE_URL = PROVIDER_METADATA.careersApiBaseUrl
export const CAREER_ORGS_API_URL = PROVIDER_METADATA.careersOrgsApiUrl
export const CAREER_JOBS_API_URL = PROVIDER_METADATA.careersJobsApiUrl
export const EXPECTED_ORG_ID = PROVIDER_METADATA.expectedOrgId
export const EXPECTED_ORG_SLUG = PROVIDER_METADATA.expectedOrgSlug
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeSlug = (value) => normalizeWhitespace(value)?.toLowerCase().replace(/[^a-z0-9]/g, '') || null

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const htmlToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
)

export const extractCareersLink = (html) => {
  const matches = [...String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  for (const [, href, label] of matches) {
    const normalizedHref = normalizeWhitespace(href)
    const normalizedLabel = normalizeWhitespace(label)
    if (/careers/i.test(normalizedLabel || '') && normalizedHref) {
      return new URL(normalizedHref, HOMEPAGE_URL).toString()
    }
  }

  return null
}

export const hasOfficialJobsSiteSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at IndustryBuying\s*<\/title>/i.test(page)
    && /Build India(?:&#x27;|')s largest B2B marketplace with us\./i.test(page)
    && /href=["']\/jobs["']/i.test(page)
    && /View all roles/i.test(page)
}

export const extractExpectedOrg = (payload) => {
  const orgs = Array.isArray(payload?.data) ? payload.data : []

  return orgs.find((org) =>
    normalizeWhitespace(org?.id) === EXPECTED_ORG_ID
    && normalizeSlug(org?.slug) === EXPECTED_ORG_SLUG
    && normalizeSlug(org?.name) === EXPECTED_ORG_SLUG)
    || null
}

export const extractJobSummaries = (payload, { orgId = EXPECTED_ORG_ID } = {}) => {
  const jobs = Array.isArray(payload?.data) ? payload.data : null
  if (!jobs) {
    throw new Error('IndustryBuying careers jobs payload no longer returns a data array')
  }

  return jobs
    .filter((job) => normalizeWhitespace(job?.orgId) === orgId)
    .map((job) => {
      const id = normalizeWhitespace(job?.id)
      const title = normalizeWhitespace(job?.title)
      const location = normalizeWhitespace(job?.location)

      if (!id || !title || !location) {
        throw new Error('IndustryBuying careers jobs payload no longer exposes the verified summary job fields')
      }

      return {
        id,
        orgId: normalizeWhitespace(job?.orgId),
        requisitionId: normalizeWhitespace(job?.requisitionId),
        title,
        department: normalizeWhitespace(job?.department),
        location,
        jobType: normalizeWhitespace(job?.jobType),
        openings: Number.isFinite(Number(job?.openings)) ? Number(job.openings) : null,
        createdAt: normalizePostingDate(job?.createdAt),
        nativeListingRecord: structuredClone(job),
      }
    })
}

export const extractJobDetail = (payload) => {
  const detail = payload?.data
  if (!detail || typeof detail !== 'object') {
    throw new Error('IndustryBuying careers detail payload no longer exposes a data object')
  }

  return detail
}

export const buildJobDetailUrl = (jobId) => `${JOBS_SITE_URL}jobs/detail?id=${encodeURIComponent(jobId)}`
export const buildApplyUrl = (jobId) => `${JOBS_SITE_URL}jobs/apply?id=${encodeURIComponent(jobId)}`

export const mapJob = ({ summary, detail }) => {
  const jobId = normalizeWhitespace(summary?.id)
  const title = normalizeWhitespace(detail?.title || summary?.title)
  const requisitionId = normalizeWhitespace(detail?.requisitionId || detail?.reqId || summary?.requisitionId)
  const employmentType = normalizeWhitespace(detail?.jobType || summary?.jobType)
  const description = htmlToText(detail?.jobDescription)

  if (summary?.orgId !== EXPECTED_ORG_ID || detail?.orgId !== summary.orgId
    || !summary.requisitionId || detail.requisitionId !== summary.requisitionId
    || detail.id !== summary.requisitionId) {
    throw new Error('IndustryBuying native employer or requisition identity mismatch')
  }

  if (!jobId || !title || !requisitionId || !description) {
    throw new Error('IndustryBuying careers detail payload no longer exposes the verified job fields')
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(detail?.department || summary?.department),
    // The current API supplies untyped office labels, such as "Delhi HO".
    // Preserve them with the complete original models until a native work
    // country is supplied; neither the employer's market nor a city proves it.
    location: null,
    city: null,
    country: null,
    rawWorkplace: {listing: summary.location ?? null, detail: detail.location ?? null},
    sourceCountryScopeUnresolved: true,
    sourceListingComplete: false,
    sourceScopeComplete: false,
    lifecycleCleanupAllowed: false,
    nativeSourceRecord: {listing: structuredClone(summary.nativeListingRecord ?? summary), detail: structuredClone(detail)},
    jobId,
    requisitionId,
    sourceUrl: buildJobDetailUrl(jobId),
    applyUrl: buildApplyUrl(jobId),
    employmentType,
    experienceRequired: normalizeWhitespace(detail?.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail?.skillsRequired)
      ? detail.skillsRequired.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(detail?.createdAt || summary?.createdAt),
    closingDate: null,
    jobDescription: description,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'industrybuying-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'industrybuying-json',
  timeoutMs: 15000,
})

export const createIndustryBuyingScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_HANDOFF_URL)
    const careersLink = extractCareersLink(homepageHtml)
    if (careersLink !== JOBS_SITE_URL) {
      throw new Error('IndustryBuying homepage no longer exposes the verified careers handoff')
    }

    const jobsSiteHtml = await fetchText(JOBS_SITE_URL)
    if (!hasOfficialJobsSiteSignal(jobsSiteHtml)) {
      throw new Error('IndustryBuying careers site no longer matches the verified first-party surface')
    }

    const org = extractExpectedOrg(await fetchJson(CAREER_ORGS_API_URL))
    if (!org) {
      throw new Error('IndustryBuying careers orgs payload no longer exposes the verified org identity')
    }

    const summaries = extractJobSummaries(
      await fetchJson(`${CAREER_JOBS_API_URL}?orgId=${encodeURIComponent(org.id)}`),
      { orgId: org.id },
    )
    const selectedSummaries = maxJobs ? summaries.slice(0, maxJobs) : summaries

    const jobs = await Promise.all(selectedSummaries.map(async (summary) => {
      const detail = extractJobDetail(
        await fetchJson(`${CAREER_JOBS_API_URL}?id=${encodeURIComponent(summary.id)}`),
      )

      return mapJob({ summary, detail })
    }))

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createIndustryBuyingScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
