import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchWorkdayJobsApiPage,
} from '../../scraper-support/myworkday/engine.js'
import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = 'ptc'
const COMPANY = 'PTC'
const CAREERS_URL = 'https://www.ptc.com/en/careers'
const BOARD_URL = 'https://ptc.wd1.myworkdayjobs.com/PTC'
const JOBS_API_URL = 'https://ptc.wd1.myworkdayjobs.com/wday/cxs/ptc/PTC/jobs'
const PAGE_SIZE = 20
const DETAIL_FETCH_CONCURRENCY = 4
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const INDIA_CITY_ALIASES = Object.keys(CANONICAL_CITIES)
  .filter((value) => !/^(?:remote|none)$/i.test(value))

const clean = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const getLocationFacetValues = (payload = {}) => {
  const mainGroup = (Array.isArray(payload.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')
  const locations = (Array.isArray(mainGroup?.values) ? mainGroup.values : [])
    .find((facet) => facet?.facetParameter === 'locations')
  if (!Array.isArray(locations?.values)) {
    if (Number(payload?.total) === 0) return []
    throw new Error('[ptc] Workday location facets changed materially')
  }
  return locations.values
}

export const extractPtcIndiaLocationFacetIds = (payload = {}) => [
  ...new Set(getLocationFacetValues(payload)
    .filter((value) => /\bindia\b/i.test(value?.descriptor || '') || /^IND-/i.test(value?.descriptor || ''))
    .map((value) => clean(value?.id))
    .filter(Boolean)),
]

const normalizeLocation = (value) => {
  const location = clean(value)
  if (!location || /^\d+\s+locations?$/i.test(location)) return 'India'
  if (/\bindia\b/i.test(location)) return location
  const indiaCode = location.match(/^IND-([^,]+?)(?:\s+-\s+|,|$)/i)?.[1]
  if (indiaCode) return `${indiaCode.trim()}, India`
  return 'India'
}

const containsKnownIndiaCity = (value) => {
  const normalized = clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  return INDIA_CITY_ALIASES.some((alias) => {
    const candidate = alias.replace(/[^a-z0-9]+/g, ' ')
    return ` ${normalized} `.includes(` ${candidate} `)
  })
}

const hasIndiaPostingEvidence = (posting = {}) => {
  const location = clean(posting.locationsText)
  const externalPath = clean(posting.externalPath)
  const pathLocation = externalPath.match(/^\/job\/([^/]+)\//i)?.[1] || ''
  if (/\b(?:united states|usa|canada|mexico|united kingdom|australia|germany|france|japan|china)\b/i.test(location)) {
    return false
  }
  if (/\bindia\b/i.test(location) || /^IND-/i.test(location)) return true
  if (location.includes(',')) return false
  if (/^(?:\d+\s+locations?|multiple locations|various locations)$/i.test(location)) {
    return /\bindia\b/i.test(pathLocation)
      || /^IND-/i.test(pathLocation)
      || containsKnownIndiaCity(pathLocation)
  }
  if (containsKnownIndiaCity(location)) return true
  return /\bindia\b/i.test(pathLocation)
    || /^IND-/i.test(pathLocation)
    || containsKnownIndiaCity(pathLocation)
}

const deriveCity = (location) => {
  const value = clean(location)
    .replace(/^IND-/i, '')
    .replace(/\s*,?\s*India$/i, '')
    .split(/\s+-\s+|,/)[0]
    ?.trim()
  return value && !/^\d+\s+locations?$/i.test(value) ? normalizeCity(value) : null
}

const extractBulletJobId = (posting = {}) => (
  (Array.isArray(posting.bulletFields) ? posting.bulletFields : []).map(clean).find(Boolean) || null
)

const extractPathJobId = (posting = {}) => (
  clean(posting.externalPath).match(/_([^/]+)$/)?.[1] || null
)

const extractJobId = (posting = {}) => {
  const bulletId = extractBulletJobId(posting)
  const pathId = extractPathJobId(posting)
  if (bulletId) return bulletId
  return pathId?.replace(/-\d+$/, '') || null
}

const hasConsistentJobIdentity = (posting = {}) => {
  const bulletId = extractBulletJobId(posting)
  const pathId = extractPathJobId(posting)
  if (!bulletId || !pathId) return true
  return pathId === bulletId || pathId.startsWith(`${bulletId}-`) && /^\d+$/.test(pathId.slice(bulletId.length + 1))
}

const mapPosting = (posting, scrapedAt) => {
  const title = clean(posting?.title)
  const jobId = extractJobId(posting)
  const externalPath = clean(posting?.externalPath)
  if (!title || !jobId || !externalPath.startsWith('/job/')) return null
  const sourceUrl = new URL(`${BOARD_URL}${externalPath}`).toString()
  const rawLocation = clean(posting?.locationsText)
  const location = normalizeLocation(rawLocation)
  return {
    title,
    company: COMPANY,
    location,
    locations: rawLocation ? [rawLocation] : [],
    city: deriveCity(rawLocation),
    country: 'India',
    link: sourceUrl,
    sourceUrl,
    applyUrl: `${sourceUrl}/apply`,
    jobId,
    requisitionId: jobId,
    department: null,
    employmentType: null,
    remoteStatus: /remote|home office/i.test(rawLocation) ? 'Remote' : null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    experienceRequired: null,
    postingDate: clean(posting?.postedOn) || null,
    closingDate: null,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: 'ptc.com',
    atsPlatform: 'workday-jobs-api',
    scrapedAt,
  }
}

const buildRequest = ({ appliedFacets = {}, offset = 0, limit = PAGE_SIZE } = {}) => ({
  jobsApiUrl: JOBS_API_URL,
  bootstrapUrl: BOARD_URL,
  appliedFacets,
  offset,
  limit,
  searchText: '',
  source: SOURCE,
})

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

export const createPtcScraper = ({
  pageSize = PAGE_SIZE,
  maxPages = 100,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchJobsPage = fetchWorkdayJobsApiPage,
    fetchPage = defaultFetchPage,
  } = {}) {
    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      throw new Error('[ptc] pageSize must be a positive integer')
    }
    if (!Number.isInteger(maxPages) || maxPages <= 0) {
      throw new Error('[ptc] maxPages must be a positive integer')
    }

    const facetPayload = await fetchJobsPage(buildRequest({ limit: pageSize }))
    const locationFacetIds = extractPtcIndiaLocationFacetIds(facetPayload)
    if (locationFacetIds.length === 0) return []

    const jobs = []
    const seen = new Set()
    const seenRaw = new Set()
    const scrapedAt = now()
    let declaredTotal = null
    let offset = 0

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJobsPage(buildRequest({
        appliedFacets: { locations: locationFacetIds },
        offset,
        limit: pageSize,
      }))
      if (!Array.isArray(payload?.jobPostings)) {
        throw new Error('[ptc] Workday response no longer exposes jobPostings')
      }
      const payloadTotal = Number(payload.total)
      if (!Number.isFinite(payloadTotal) || payloadTotal < 0) {
        throw new Error('[ptc] Workday response has an invalid total')
      }
      if (!Number.isInteger(payloadTotal)) {
        throw new Error('[ptc] Workday response total must be an integer')
      }
      if (declaredTotal != null && payloadTotal !== 0 && declaredTotal !== payloadTotal) {
        throw new Error('[ptc] Workday total changed during pagination')
      }
      if (declaredTotal == null) declaredTotal = payloadTotal
      const postings = payload.jobPostings
      for (const posting of postings) {
        if (
          !clean(posting?.title)
          || !extractJobId(posting)
          || !clean(posting?.externalPath).startsWith('/job/')
          || !clean(posting?.locationsText)
        ) {
          throw new Error('[ptc] Workday returned a malformed filtered posting with missing required fields')
        }
        if (!hasConsistentJobIdentity(posting)) {
          throw new Error('[ptc] Workday posting bullet ID contradicts its detail URL identity')
        }
      }
      const rawIdentities = postings.map((posting) => (
        extractJobId(posting) || clean(posting?.externalPath)
      ))
      if (rawIdentities.some((identity) => !identity)) {
        throw new Error('[ptc] Workday posting is missing a stable identity')
      }
      const newRawCount = rawIdentities.filter((identity) => !seenRaw.has(identity)).length
      rawIdentities.forEach((identity) => seenRaw.add(identity))
      if (seenRaw.size > declaredTotal) {
        throw new Error('[ptc] Workday returned more unique jobs than its declared total')
      }
      for (const posting of postings) {
        if (!hasIndiaPostingEvidence(posting)) {
          throw new Error('[ptc] India-filtered Workday page returned a foreign or ambiguous location')
        }
        const job = mapPosting(posting, scrapedAt)
        if (!job) throw new Error('[ptc] failed to normalize a validated Workday posting')
        if (seen.has(job.jobId)) continue
        seen.add(job.jobId)
        jobs.push(job)
      }
      offset += postings.length
      if (postings.length === 0) {
        if (seenRaw.size < declaredTotal) {
          throw new Error('[ptc] Workday pagination ended before its declared total')
        }
        break
      }
      if (seenRaw.size === declaredTotal) break
      if (newRawCount === 0) {
        throw new Error('[ptc] Workday pagination made no progress')
      }
      if (postings.length < pageSize) {
        throw new Error('[ptc] Workday returned a premature short page below its declared total')
      }
      if (page + 1 >= maxPages) {
        throw new Error(`[ptc] Workday pagination limit reached after ${maxPages} pages; refusing truncated results`)
      }
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
            postingDate: detail.postingDate || job.postingDate,
            requisitionId: detail.requisitionId || job.requisitionId,
          }
        } catch {
          return job
        }
      },
    )

    return enrichedJobs.sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = (options = {}) => createPtcScraper().run(options)

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
