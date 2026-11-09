import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { loadNativePaginationDefaults, nativePaginationLimits, createNativePagination, readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)
const nativeDefaults = loadNativePaginationDefaults(currentDir)

export const CAREER_PAGE_URL = 'https://www.capgemini.com/careers/join-capgemini/job-search/'
export const API_BASE_URL = 'https://cg-jobstream-api.azurewebsites.net'
export const INDIA_COUNTRY_CODE = 'en-in'
const DEFAULT_PAGE_SIZE = 10

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''

  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('temporary') || normalized.includes('fixed term')) return 'Contract'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('part')) return null
  if (normalized.includes('permanent') || normalized.includes('full')) return 'Full-time'
  return normalizeWhitespace(value)
}

const isIndiaJob = (record = {}) =>
  normalizeWhitespace(record.country_code)?.toLowerCase() === INDIA_COUNTRY_CODE
  || normalizeWhitespace(record.source_ref)?.toLowerCase().startsWith(`${INDIA_COUNTRY_CODE}:`)
  || /india/i.test(String(record.location || ''))

const buildQueryUrl = (pathname, params = {}) => {
  const url = new URL(pathname, `${API_BASE_URL}/`)

  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

export const buildFiltersUrl = () => buildQueryUrl('/api/job-filters/')

export const buildSearchUrl = ({
  page = 1,
  size = DEFAULT_PAGE_SIZE,
} = {}) => buildQueryUrl('/api/job-search', {
  page: Math.max(1, Number(page) || 1),
  size: Math.max(1, Number(size) || DEFAULT_PAGE_SIZE),
  country_code: INDIA_COUNTRY_CODE,
})

export const extractPaginationSummary = (payload, {
  page = 1,
  size = DEFAULT_PAGE_SIZE,
} = {}) => {
  const pageSize = Math.max(1, Number(size) || DEFAULT_PAGE_SIZE)
  const totalRecords = Number(payload?.count ?? payload?.total) || 0
  const totalPages = pageSize > 0 ? Math.ceil(totalRecords / pageSize) : 0
  const currentPage = Math.max(1, Number(page) || 1)

  return {
    page: currentPage,
    pageSize,
    totalRecords,
    totalPages,
    hasNext: totalPages > 0 ? currentPage < totalPages : false,
  }
}

export const extractSearchResults = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter((record) => isIndiaJob(record))
  .map((record) => {
    const jobId = normalizeWhitespace(record.id)
    const requisitionId = normalizeWhitespace(record.ref || record.source_ref || record.id)
    const sourceUrl = normalizeWhitespace(record.apply_job_url)
    const location = normalizeLocation(record.location)
    const jobDescription = stripTags(record.description)

    if (!jobId || !requisitionId || !sourceUrl || !location) return null

    return {
      title: normalizeWhitespace(record.title),
      company: 'Capgemini',
      department: normalizeWhitespace(record.professional_communities),
      location,
      city: extractCity(location),
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(record.contract_type),
      experienceRequired: normalizeWhitespace(record.experience_level),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(record.updated_at || record.indexed_at),
      closingDate: null,
      jobDescription,
      publicExperienceChecked: Boolean(jobDescription),
    }
  })
  .filter(Boolean)

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createCapgeminiScraper = ({
  size = Number.isInteger(config.pageSize) ? config.pageSize : DEFAULT_PAGE_SIZE,
  maxJobs = nativeDefaults.maxJobs,
  maxPages = nativeDefaults.maxPages,
} = {}) => ({
  async run(options = {}) {
    const signal = options.signal
    signal?.throwIfAborted()
    const limits = nativePaginationLimits(options, { maxPages, maxJobs })
    const pagination = createNativePagination({ surface: buildSearchUrl(), limits, signal, collectionBudgetMs: options.collectionBudgetMs, identityScope: 'native-raw' })
    const fetchJson = options.fetchJson || defaultFetchJson
    const jobs = []
    return pagination.run(jobs, async () => {
      const seenJobIds = new Set()

      for (let page = 1; page <= limits.maxPages; page += 1) {
        const payload = await readNativeWithSignal(() => fetchJson(buildSearchUrl({ page, size }), { signal: pagination.signal }), pagination.signal)
        const listings = extractSearchResults(payload)
        const summary = extractPaginationSummary(payload, { page, size })
        const rawRows = Array.isArray(payload?.data) ? payload.data : []
        const progress = pagination.page(rawRows.map(record => normalizeWhitespace(record?.id)), summary.totalRecords)
        if (!progress) return pagination.finish(jobs, { exhausted: !summary.hasNext })

        for (const job of listings) {
          if (seenJobIds.has(job.jobId)) continue
          seenJobIds.add(job.jobId)
          jobs.push({
            ...job,
            source: 'capgemini',
            link: job.applyUrl || job.sourceUrl,
            scrapedAt: new Date().toISOString(),
          })

          if (jobs.length >= limits.maxJobs) {
            return pagination.finish(jobs)
          }
        }

        if (!summary.hasNext) {
          return pagination.finish(jobs, { exhausted: true })
        }
      }

      return pagination.finish(jobs)
    })
  },
})

export const run = async (options = {}) => createCapgeminiScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Capgemini scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'capgemini')
    console.log('DB result:', result)
    process.exit(0)
  }
}
