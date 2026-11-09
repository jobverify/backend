import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobs.aon.com'
const INDIA_LOCATION = 'India'
const DEFAULT_PAGE_SIZE = 100

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const decodeBasicEntities = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/full[_\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[_\s-]?time/i.test(normalized)) return null
  if (/contract/i.test(normalized)) return 'Contract'
  if (/intern/i.test(normalized)) return 'Internship'
  return normalized
}

const buildCanonicalJobUrl = (job = {}) => {
  const canonicalUrl = normalizeWhitespace(job.meta_data?.canonical_url)
  if (canonicalUrl) return canonicalUrl
  const slug = normalizeWhitespace(job.slug || job.req_id)
  return slug ? `${BASE_URL}/jobs/${slug}?lang=en-us` : null
}

export const buildIndiaJobsApiUrl = ({ page = 1, limit = DEFAULT_PAGE_SIZE } = {}) => {
  const url = new URL('/api/jobs', BASE_URL)
  url.searchParams.set('location', INDIA_LOCATION)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const extractJobsPayload = (payload = {}) => ({
  jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
  totalCount: Number.isInteger(payload.totalCount) ? payload.totalCount : 0,
  count: Number.isInteger(payload.count) ? payload.count : 0,
})

const extractExperienceRequired = (description) => {
  const text = decodeBasicEntities(description)
  if (!text) return null
  const matched = text.match(
    /((?:\d+\s*-\s*\d+|\d+\+?)\s+years? of relevant experience[\s\S]*?Relevant pre-MBA experience in the areas we operate\.)/i,
  )
  return normalizeWhitespace(matched?.[1]?.toLowerCase()) || null
}

const extractMinimumQualification = (description) => {
  const text = decodeBasicEntities(description)
  if (!text) return null
  const matched = text.match(
    /Required education and certifications critical for the role[:\-]?\s*([\s\S]*?)(?=Technical Skills:|ABOUT AON|Aon is in the business of better decisions|$)/i,
  )
  return normalizeWhitespace(matched?.[1]) || null
}

const extractRequiredSkills = (description) => {
  const text = decodeBasicEntities(description)?.toLowerCase() || ''
  const knownSkills = [
    'excel',
    'analytics',
    'vba',
    'macros',
    'predictive analytics',
    'statistical modelling',
    'linear regression',
    'microsoft powerpoint',
    'client relationship management',
  ]

  return knownSkills.filter((skill) => text.includes(skill))
}

export const normalizeJobListing = (item = {}) => {
  const job = item?.data || {}
  const category = Array.isArray(job.category) ? job.category[0] : job.category
  const description = decodeBasicEntities(job.responsibilities || job.description)

  return {
    title: normalizeWhitespace(job.title),
    location: normalizeWhitespace(job.full_location || [job.city, job.country].filter(Boolean).join(', ')),
    city: normalizeWhitespace(job.city),
    country: normalizeWhitespace(job.country),
    jobId: normalizeWhitespace(job.req_id || job.slug),
    requisitionId: normalizeWhitespace(job.req_id || job.slug),
    department: normalizeWhitespace(category),
    employmentType: normalizeEmploymentType(job.employment_type),
    experienceRequired: extractExperienceRequired(description),
    jobDescription: description,
    minimumQualification: extractMinimumQualification(description),
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(description),
    postingDate: normalizeWhitespace(job.posted_date),
    applyUrl: normalizeWhitespace(job.apply_url),
    sourceUrl: buildCanonicalJobUrl(job),
  }
}

const fetchJson = async (url, attempt = 0) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        Accept: 'application/json,text/plain,*/*',
        Referer: 'https://jobs.aon.com/jobs?location=India',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response.json()
  } catch (error) {
    if (attempt >= ((config.retryAttempts || 1) - 1)) throw error
    const delay = (config.retryBaseDelayMs || 1000) * (attempt + 1)
    await new Promise((resolve) => setTimeout(resolve, delay))
    return fetchJson(url, attempt + 1)
  }
}

export const createAonScraper = () => ({
  buildIndiaJobsApiUrl,
  extractJobsPayload,
  normalizeJobListing,
  run: async (options = {}) => {
    const getJson = options.fetchJson || fetchJson
    const pageSize = Number.isInteger(options.limit) ? options.limit : DEFAULT_PAGE_SIZE
    const maxPages = Number.isInteger(options.maxPages)
      ? options.maxPages
      : (Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY)
    const maxJobs = Number.isInteger(options.maxJobs) ? options.maxJobs : Number.POSITIVE_INFINITY

    const jobs = []
    const seenJobIds = new Set()
    let totalCount = null

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = extractJobsPayload(
        await getJson(buildIndiaJobsApiUrl({ page, limit: pageSize })),
      )

      if (!payload.jobs.length) break

      totalCount = payload.totalCount || totalCount

      for (const item of payload.jobs) {
        const normalized = normalizeJobListing(item)
        if (!normalized.jobId || seenJobIds.has(normalized.jobId)) continue
        seenJobIds.add(normalized.jobId)

        jobs.push({
          ...normalized,
          company: 'Aon',
          source: 'aon',
          link: normalized.applyUrl || normalized.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (jobs.length >= maxJobs) return jobs
      }

      if (payload.count < pageSize) break
      if (Number.isInteger(totalCount) && jobs.length >= totalCount) break
    }

    return jobs
  },
})

const scraper = createAonScraper()

export const {
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AON scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'aon')
    console.log('DB result:', result)
    process.exit(0)
  }
}
