import path from 'path'
import { fileURLToPath } from 'url'

import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from '../../scraper-support/myworkday/engine.js'
import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.finastra.com/careers/life-at-finastra'
export const WORKDAY_BASE_URL = 'https://finastra.wd3.myworkdayjobs.com/FINC'
export const JOBS_API_URL = 'https://finastra.wd3.myworkdayjobs.com/wday/cxs/finastra/FINC/jobs'
export const SOURCE = 'finastra'
export const COMPANY_NAME = 'Finastra'
export const DEFAULT_PAGE_SIZE = 20
const DETAIL_FETCH_CONCURRENCY = 4
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_DESCRIPTORS = new Set([
  'bangalore',
  'bengaluru',
  'pune',
])

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const isGroupedLocationLabel = (value) => /^\d+\s+locations?$/i.test(normalizeWhitespace(value) || '')

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const limit = Math.max(1, Number.parseInt(concurrency, 10) || 1)
  const results = new Array(items.length)
  let nextIndex = 0
  let firstError = null

  const worker = async () => {
    while (!firstError) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) return
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex)
      } catch (error) {
        firstError ||= error
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )

  if (firstError) throw firstError
  return results
}

const normalizePathLocation = (value) => {
  const normalized = normalizeWhitespace(
    decodeURIComponent(String(value ?? ''))
      .replace(/---/g, ' - ')
      .replace(/-/g, ' '),
  )

  if (!normalized) return null
  if (/^virtual\b/i.test(normalized) && /\bindia\b/i.test(normalized)) {
    return 'Virtual - India'
  }

  return normalized
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^virtual\b/i.test(normalized) && /\bindia\b/i.test(normalized)) {
    return 'Virtual - India'
  }
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^virtual\b/i.test(normalized)) return 'Remote'
  return normalized.replace(/,\s*India$/i, '').trim() || null
}

const getLocationFacetValues = (payload = {}) => {
  const nestedValues = []

  for (const facet of Array.isArray(payload?.facets) ? payload.facets : []) {
    if (facet?.facetParameter === 'locations' && Array.isArray(facet.values)) {
      nestedValues.push(...facet.values)
    }

    for (const value of Array.isArray(facet?.values) ? facet.values : []) {
      if (value?.facetParameter === 'locations' && Array.isArray(value.values)) {
        nestedValues.push(...value.values)
      }
    }
  }

  return nestedValues
}

export const buildJobsRequest = ({
  appliedFacets = {},
  limit = DEFAULT_PAGE_SIZE,
  offset = 0,
  searchText = '',
} = {}) => ({
  appliedFacets,
  limit,
  offset,
  searchText,
})

export const extractIndiaLocationFacetIds = (payload) => {
  const seen = new Set()

  return getLocationFacetValues(payload)
    .filter((value) => {
      const descriptor = normalizeWhitespace(value?.descriptor)?.toLowerCase()
      if (!descriptor) return false
      return /\bindia\b/.test(descriptor) || INDIA_LOCATION_DESCRIPTORS.has(descriptor)
    })
    .map((value) => normalizeWhitespace(value?.id))
    .filter((id) => {
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
}

export const buildJobDetailUrl = (externalPath) => {
  const normalized = normalizeWhitespace(externalPath)
  if (!normalized) return null
  if (/^https?:\/\//i.test(normalized)) return normalized
  return `${WORKDAY_BASE_URL}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
}

const extractPathLocation = (externalPath) => {
  const match = String(externalPath ?? '').match(/^\/job\/([^/]+)/i)
  return match ? normalizePathLocation(match[1]) : null
}

const toJob = (posting = {}) => {
  const title = normalizeWhitespace(posting.title)
  const requisitionId = normalizeWhitespace(posting?.bulletFields?.[0])
  const sourceUrl = buildJobDetailUrl(posting.externalPath)
  const rawLocation = isGroupedLocationLabel(posting.locationsText)
    ? extractPathLocation(posting.externalPath)
    : normalizeWhitespace(posting.locationsText) || extractPathLocation(posting.externalPath)
  const location = normalizeLocation(rawLocation)

  if (!title || !requisitionId || !sourceUrl || !location) {
    return null
  }

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location,
    city: extractCity(location),
    country: 'India',
    jobId: requisitionId,
    requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(posting.postedOn),
    closingDate: null,
    jobDescription: null,
  }
}

export const extractSearchResults = (payload) => (Array.isArray(payload?.jobPostings) ? payload.jobPostings : [])
  .map((posting) => toJob(posting))
  .filter(Boolean)

export const extractPaginationSummary = (payload, { offset = 0, limit = DEFAULT_PAGE_SIZE } = {}) => {
  const jobsCount = Array.isArray(payload?.jobPostings) ? payload.jobPostings.length : 0
  const totalCount = Number(payload?.total) || 0
  const nextOffset = offset + jobsCount

  return {
    jobsCount,
    totalCount,
    nextOffset,
    hasNext: totalCount > 0 ? nextOffset < totalCount : jobsCount >= limit,
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  const html = await response.text()
  if (hasWorkdayOutageSignal({html, url: response.url})) {
    throw new WorkdayUpstreamOutageError(`[${SOURCE}] Workday is currently unavailable upstream at ${url}`)
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return JSON.parse(html)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createFinastraScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
} = {}) => ({
  async run({
    fetchJson = defaultFetchJson,
    fetchPage = defaultFetchPage,
  } = {}) {
    const discoveryPayload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      body: JSON.stringify(buildJobsRequest({
        limit: pageSize,
      })),
    })

    const indiaLocationIds = extractIndiaLocationFacetIds(discoveryPayload)
    if (!indiaLocationIds.length) return []

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize
      const payload = await fetchJson(JOBS_API_URL, {
        method: 'POST',
        body: JSON.stringify(buildJobsRequest({
          appliedFacets: { locations: indiaLocationIds },
          limit: pageSize,
          offset,
        })),
      })

      const pageJobs = extractSearchResults(payload)
      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      const summary = extractPaginationSummary(payload, { offset, limit: pageSize })
      if (!summary.hasNext) break
    }

    const enrichedJobs = await mapWithConcurrency(
      jobs,
      DETAIL_FETCH_CONCURRENCY,
      async (job) => {
        try {
          const detailPage = await fetchPage(job.sourceUrl)
          if (Number(detailPage?.status) !== 200 || !detailPage?.html) {
            return job
          }

          const detail = await extractJobDetail({
            provider: 'workday',
            html: detailPage.html,
          })

          return {
            ...job,
            department: detail.department || job.department,
            jobDescription: detail.jobDescription || job.jobDescription,
            minimumQualification: detail.minimumQualification || job.minimumQualification,
            preferredQualification: detail.preferredQualification || job.preferredQualification,
            requiredSkills: Array.isArray(detail.requiredSkills) && detail.requiredSkills.length > 0
              ? detail.requiredSkills
              : job.requiredSkills,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
            requisitionId: detail.requisitionId || job.requisitionId,
            postingDate: detail.postingDate || job.postingDate,
          }
        } catch {
          return job
        }
      },
    )

    return enrichedJobs
  },
})

export const run = async (options = {}) => createFinastraScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Finastra scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
