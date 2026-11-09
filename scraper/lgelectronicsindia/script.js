import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserNetworkFallback } from '../../scraper-support/shared/browserNetworkFallback.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import { LG_ELECTRONICS_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LG_ELECTRONICS_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const LOCATIONS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_SEARCH_URL = 'https://globalcareers.lge.com/jobs'
export const JOBS_API_BASE_URL = 'https://globalcareers.lge.com/api/job/v1/jobs/'
export const PAGE_SIZE = 100

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const formatDateParts = (parts) => {
  if (!Array.isArray(parts) || parts.length < 3) return null
  const [year, month, day] = parts
  if (![year, month, day].every((value) => Number.isInteger(value))) return null

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const buildJobsApiUrl = (page = 1, size = PAGE_SIZE) =>
  `${JOBS_API_BASE_URL}?page=${page}&size=${size}`

export const buildJobDetailUrl = (jobId) =>
  `https://globalcareers.lge.com/jobs/${normalizeWhitespace(jobId) || ''}`

export const hasOfficialIndiaLocationSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Jobs at LG India \| LG Global Careers\s*<\/title>/i.test(page)
    && text.includes('India')
    && text.includes('Explore Jobs')
    && text.includes('LG Electronics')
    && text.includes('Equal Opportunity')
    && text.includes('Dedicated to creating an inclusive workplace')
}

export const hasOfficialJobsSearchSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*LG Job Search &(?:amp;|&) Openings \| LG Global Careers\s*<\/title>/i.test(page)
    && text.includes('Job Search')
    && text.includes('Filter Region')
    && text.includes('Search')
}

export const extractIndiaJobs = (payload = {}) =>
  (Array.isArray(payload?.data?.list) ? payload.data.list : [])
    .filter((job) => String(job?.cntryCd ?? '').toUpperCase() === 'IN')
    .filter((job) => normalizeWhitespace(job?.status)?.toUpperCase() === 'OPEN')
    .map((job) => {
      const jobId = normalizeWhitespace(job.id)
      const title = normalizeWhitespace(job.title)
      const city = normalizeWhitespace(job.location)
      if (!jobId || !title || !city) return null

      const detailUrl = buildJobDetailUrl(jobId)

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job.corpType) || normalizeWhitespace(job.jobFamily) || null,
        location: `${city}, India`,
        city,
        country: 'India',
        jobId,
        requisitionId: normalizeWhitespace(job.corpCd) ? `${normalizeWhitespace(job.corpCd)}-${jobId}` : jobId,
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        employmentType: normalizeWhitespace(job.empType) || null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: formatDateParts(job.postCreateDtm),
        closingDate: null,
        jobDescription: stripTags(job.content) || null,
      }
    })
    .filter(Boolean)

export const createLgElectronicsIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchBrowserText,
      userAgent: USER_AGENT,
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 12000,
        ignoreHTTPSErrors: false,
      },
    })

    try {
      const locationPageHtml = await browserFallback.fetchTextInBrowser(LOCATIONS_PAGE_URL)
      if (!hasOfficialIndiaLocationSignal(locationPageHtml)) {
        throw new Error('LG Electronics India verified India location page no longer matches the known public surface')
      }

      const jobsSearchHtml = await fetchText(JOBS_SEARCH_URL)
      if (!hasOfficialJobsSearchSignal(jobsSearchHtml)) {
        throw new Error('LG Electronics India verified jobs search page no longer matches the known public surface')
      }

      const firstPagePayload = await fetchJson(buildJobsApiUrl(1))
      const totalJobs = Number.parseInt(String(firstPagePayload?.data?.total ?? ''), 10)
      const totalPages = Number.isFinite(totalJobs) && totalJobs > 0
        ? Math.ceil(totalJobs / PAGE_SIZE)
        : 1

      const jobs = []
      const seenJobIds = new Set()

      for (let page = 1; page <= totalPages; page += 1) {
        const payload = page === 1 ? firstPagePayload : await fetchJson(buildJobsApiUrl(page))

        for (const job of extractIndiaJobs(payload)) {
          if (seenJobIds.has(job.jobId)) continue
          seenJobIds.add(job.jobId)
          jobs.push({
            ...job,
            source: SOURCE,
            link: job.applyUrl || job.sourceUrl,
            scrapedAt: now(),
          })
        }
      }

      if (jobs.length === 0) {
        throw new Error('LG Electronics India verified jobs API no longer exposes public India roles')
      }

      return jobs
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createLgElectronicsIndiaScraper(options).run(options)

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
