import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import {
  buildWorkdayAppliedFacets,
  extractCity,
  matchesWorkdayLocationPattern,
  shouldContinueWorkdayJobsApiPagination,
  shouldFetchWorkdayJobDetail,
} from '../../scraper-support/myworkday/engine.js'
import { extractWorkdayDetailLocations } from '../../scraper-support/myworkday/locationDetails.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.factset.com/careers'
export const BASE_URL = 'https://factset.wd108.myworkdayjobs.com/FactSetCareers'
export const JOBS_API_URL = 'https://factset.wd108.myworkdayjobs.com/wday/cxs/factset/FactSetCareers/jobs'

const COMPANY_NAME = 'FactSet'
const SOURCE = 'factset'
const PAGE_SIZE = 20
const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'
const INDIA_LOCATION_PATTERN = 'india|\\bind\\b|hyderabad|mumbai|chennai|pune|bengaluru|bangalore|noida|gurgaon|gurugram'

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body,
  attempts: config.retryAttempts,
  baseDelayMs: config.retryBaseDelayMs,
  timeoutMs: config.jobListingTimeoutMs,
  label: 'factset jobs api',
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: config.retryAttempts,
  baseDelayMs: config.retryBaseDelayMs,
  timeoutMs: config.jobListingTimeoutMs,
  label: 'factset detail',
})

const startOfTodayIST = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const nowIST = new Date(Date.now() + IST_OFFSET_MS)
  return new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()))
}

const toUTCMidnight = (dateStr) => {
  const value = new Date(dateStr)
  if (Number.isNaN(value.getTime())) return null
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

const parsePostedOn = (raw) => {
  if (!raw) return null

  const text = String(raw).trim().toLowerCase()
  const today = startOfTodayIST()
  const daysAgo = (days) => {
    const value = new Date(today)
    value.setUTCDate(value.getUTCDate() - days)
    return value
  }

  if (/\btoday\b/.test(text)) return daysAgo(0)
  if (/\byesterday\b/.test(text)) return daysAgo(1)

  const relativeMatch = text.match(/(\d+)\s+days?\s+ago/)
  if (relativeMatch) {
    return daysAgo(Number.parseInt(relativeMatch[1], 10))
  }

  return toUTCMidnight(String(raw).replace(/^posted\s+/i, '').trim())
}

const extractJobId = (posting = {}) => {
  const requisition = Array.isArray(posting.bulletFields)
    ? posting.bulletFields.find((value) => /^R\d+(?:-\d+)?$/i.test(String(value)))
    : null

  if (requisition) return requisition

  const match = String(posting.externalPath ?? '').match(/_(R\d+(?:-\d+)?)(?:\/)?$/i)
  return match?.[1] ?? null
}

export const buildJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  searchText = '',
} = {}) => JSON.stringify({
  appliedFacets: buildWorkdayAppliedFacets(BASE_URL, INDIA_LOCATION_COUNTRY),
  limit,
  offset,
  searchText,
})

const buildDetailUrl = (externalPath) => {
  if (!externalPath) return null

  try {
    const normalizedPath = String(externalPath).replace(/^\/+/, '')
    return new URL(normalizedPath, `${BASE_URL.replace(/\/+$/, '')}/`).href.split('?')[0]
  } catch {
    return null
  }
}

const selectPrimaryLocation = (summaryLocation, detailLocations = []) =>
  detailLocations.find((value) =>
    matchesWorkdayLocationPattern({ location: value }, INDIA_LOCATION_PATTERN),
  ) || summaryLocation

const extractDetailPayload = async (jobUrl, fetchText) => {
  const html = await fetchText(jobUrl)

  return {
    locations: extractWorkdayDetailLocations(html),
    ...(await extractJobDetail({ provider: 'workday', html })),
  }
}

export const createFactSetScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenLinks = new Set()
    let offset = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildJobsRequestBody({ offset }),
      )
      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []

      if (page === 1 && postings.length === 0) {
        return []
      }

      for (const posting of postings) {
        const summaryLocation = String(posting?.locationsText ?? '').trim() || 'Unknown'
        if (!shouldFetchWorkdayJobDetail({ location: summaryLocation }, INDIA_LOCATION_PATTERN)) {
          continue
        }

        const link = buildDetailUrl(posting?.externalPath)
        if (!link || seenLinks.has(link)) continue

        seenLinks.add(link)

        let detailPayload
        try {
          detailPayload = await extractDetailPayload(link, fetchText)
        } catch (error) {
          console.warn(`  [${SOURCE}] Failed to enrich ${link}: ${error.message}`)
          detailPayload = {
            locations: [],
            jobDescription: null,
            minimumQualification: null,
            preferredQualification: null,
            requiredSkills: [],
            experienceRequired: null,
            department: null,
            requisitionId: null,
          }
        }

        if (!matchesWorkdayLocationPattern(
          {
            location: summaryLocation,
            locations: detailPayload.locations,
          },
          INDIA_LOCATION_PATTERN,
        )) {
          continue
        }

        const location = selectPrimaryLocation(summaryLocation, detailPayload.locations)
        const jobId = extractJobId(posting)

        jobs.push({
          jobId,
          title: posting.title,
          company: COMPANY_NAME,
          department: detailPayload.department,
          location,
          city: extractCity(location),
          locations: detailPayload.locations,
          link,
          source: SOURCE,
          postedAt: parsePostedOn(posting.postedOn),
          closingDate: null,
          jobDescription: detailPayload.jobDescription,
          minimumQualification: detailPayload.minimumQualification,
          preferredQualification: detailPayload.preferredQualification,
          requiredSkills: detailPayload.requiredSkills,
          experienceRequired: detailPayload.experienceRequired,
          requisitionId: detailPayload.requisitionId || jobId,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs.slice(0, maxJobs)
        }
      }

      offset += postings.length
      if (!shouldContinueWorkdayJobsApiPagination({
        jobsCount: postings.length,
        offsetAfterPage: offset,
        payloadTotal: payload?.total || 0,
        pageSize: PAGE_SIZE,
      })) {
        break
      }
    }

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createFactSetScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running FactSet scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
