import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { GEEKSFORGEEKS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = GEEKSFORGEEKS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const JOBS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const stripTagsToText = (value) => normalizeText(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const uniqueStrings = (values = []) => {
  const seen = new Set()
  const output = []

  for (const value of values) {
    const normalized = normalizeText(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

const normalizeLocationEntry = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const match = normalized.match(/^(.*?)\s*\((.*?)\)$/)
  if (!match) return normalized

  return `${normalizeText(match[1])}, ${normalizeText(match[2])}, India`
}

const buildJobUrl = (slug) => {
  try {
    return new URL(`/jobs/${String(slug ?? '').replace(/^\/+/, '')}`, 'https://www.geeksforgeeks.org').toString()
  } catch {
    return null
  }
}

const extractDateOnly = (value) => {
  if (!value) return null
  const exactDate = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1]
  if (exactDate) return exactDate

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: DEFAULT_HEADERS,
  label: 'geeksforgeeks-jobs-page',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    ...DEFAULT_HEADERS,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'geeksforgeeks-jobs-api',
  timeoutMs: 15000,
})

export const hasJobsPageSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*GfG Get Hired\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.geeksforgeeks\.org\/jobs\/?"/i.test(page)
    && /<script id="__NEXT_DATA__" type="application\/json">/i.test(page)
}

export const extractNextDataPayload = (html = '') => {
  const rawJson = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  )?.[1]

  if (!rawJson) {
    throw new Error('GeeksforGeeks jobs page no longer matches the verified first-party surface')
  }

  return JSON.parse(rawJson)
}

export const extractSeedJobPage = (html = '') => {
  const payload = extractNextDataPayload(html)
  const seedPage = payload?.props?.pageProps?.activeJobData

  if (!seedPage || !Array.isArray(seedPage.results)) {
    throw new Error('GeeksforGeeks jobs page no longer matches the verified first-party surface')
  }

  return {
    count: seedPage.count ?? null,
    next: seedPage.next ?? null,
    previous: seedPage.previous ?? null,
    results: seedPage.results,
  }
}

const isCompanyOwnedJob = (job = {}) =>
  normalizeText(job?.organization?.name) === COMPANY

export const normalizeJob = (job = {}) => {
  const normalizedLocations = uniqueStrings(
    Array.isArray(job.location) ? job.location.map((value) => normalizeLocationEntry(value)) : [],
  )
  const location = normalizedLocations.length > 0
    ? normalizedLocations.join(' / ')
    : normalizeText(job.location_type) === 'Remote'
      ? 'Remote'
      : null
  const city = normalizedLocations.length > 0
    ? normalizeText(normalizedLocations[0].split(',')[0])
    : location === 'Remote'
      ? 'Remote'
      : null

  return {
    title: normalizeText(job?.designation?.text) || null,
    company: COMPANY,
    department: normalizeText(job.job_type),
    location,
    city,
    jobId: normalizeText(job.job_id),
    requisitionId: normalizeText(job.job_id),
    sourceUrl: buildJobUrl(job.slug),
    applyUrl: buildJobUrl(job.slug),
    employmentType: normalizeText(job.employment_type),
    experienceRequired: normalizeText(job.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: uniqueStrings(job.skills),
    postingDate: null,
    closingDate: extractDateOnly(job.last_apply_date),
    jobDescription: stripTagsToText(job.description),
    companyCareerPage: JOBS_PAGE_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
  }
}

export const createGeeksforGeeksScraper = ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run() {
    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasJobsPageSignal(jobsPageHtml)) {
      throw new Error('GeeksforGeeks jobs page no longer matches the verified first-party surface')
    }

    const pages = [extractSeedJobPage(jobsPageHtml)]
    while (
      pages.at(-1)?.next
      && pages.length < maxPages
      && (!Number.isInteger(maxJobs) || maxJobs <= 0 || pages.length === 0 || true)
    ) {
      const payload = await fetchJson(pages.at(-1).next)
      if (!payload || !Array.isArray(payload.results)) {
        throw new Error('GeeksforGeeks jobs API payload no longer matches the verified public surface')
      }

      pages.push({
        count: payload.count ?? null,
        next: payload.next ?? null,
        previous: payload.previous ?? null,
        results: payload.results,
      })
    }

    const jobs = []
    const seenJobIds = new Set()

    for (const page of pages) {
      for (const rawJob of page.results) {
        if (!isCompanyOwnedJob(rawJob)) continue

        const jobId = normalizeText(rawJob.job_id)
        if (!jobId || seenJobIds.has(jobId)) continue

        const normalized = normalizeJob(rawJob)
        if (!normalized.title || !normalized.sourceUrl) continue

        seenJobIds.add(jobId)
        jobs.push({
          ...normalized,
          source: SOURCE,
          link: normalized.applyUrl || normalized.sourceUrl,
          scrapedAt: now(),
        })

        if (Number.isInteger(maxJobs) && maxJobs > 0 && jobs.length >= maxJobs) {
          return jobs
        }
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createGeeksforGeeksScraper(options).run()

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
