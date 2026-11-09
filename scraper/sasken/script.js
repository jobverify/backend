import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const API_URL = 'https://www.hirewand.com/public/listingdata'
export const CAREER_PAGE_URL = 'https://careers.sasken.com/tb/saskenjobs/'
export const LISTING_PAGE_URL = 'https://www.hirewand.com/apply/job/listing?id=2022&country=ind&embed=true'
export const ACCOUNT_ID = '2022'
export const COUNTRY_CODE = 'ind'
export const DEFAULT_PAGE_SIZE = 50

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: LISTING_PAGE_URL,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString().slice(0, 10)
}

const dedupeSkills = (...groups) => [...new Set(
  groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean),
)]

const extractExperience = (value) => {
  const normalized = stripHtml(value)
  if (!normalized) return null

  const match = normalized.match(/\bExperience\s*:\s*([0-9]+\s*-\s*[0-9]+\s*Years?)\b/i)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractLocation = (...values) => {
  const normalized = normalizeWhitespace(values.filter(Boolean).join(' '))
  if (!normalized) return { location: 'India', city: null }

  const match = normalized.match(/\bLocation\s*[:\-]\s*([A-Za-z][A-Za-z .,&/-]*)\b/i)
  const city = normalizeWhitespace(match?.[1])

  if (!city) return { location: 'India', city: null }
  if (/india/i.test(city)) return { location: city, city: null }

  return {
    location: `${city}, India`,
    city,
  }
}

const getDescription = (record = {}) => {
  const summary = normalizeWhitespace(record.jd_summary)
  const description = stripHtml(record.jdText)

  if (description && description.length > 40) return description
  return summary || description
}

const isPublicJob = (record = {}) =>
  record.referralpostpublic !== false
  && Boolean(normalizeWhitespace(record.title))
  && Boolean(normalizeWhitespace(record.jobURL))

export const buildListingUrl = ({
  limit = DEFAULT_PAGE_SIZE,
  offset = 0,
} = {}) => `${API_URL}?accountid=${ACCOUNT_ID}&limit=${limit}&offset=${offset}`

export const buildListingFilter = ({ country = COUNTRY_CODE } = {}) =>
  JSON.stringify({ country })

const buildListingFormData = (filterJson = buildListingFilter()) => {
  const form = new FormData()
  form.append('filterjson', filterJson)
  return form
}

export const extractSearchResults = (payload) =>
  (Array.isArray(payload?.jobs?.requirements) ? payload.jobs.requirements : [])
    .filter((record) => isPublicJob(record))
    .map((record) => {
      const jobDescription = getDescription(record)
      const { location, city } = extractLocation(record.jdText, record.jd_summary)
      const sourceUrl = normalizeWhitespace(record.jobURL)
      const jobId = normalizeWhitespace(record._id)
      const requisitionId = normalizeWhitespace(record.atsreqid) || jobId

      if (!jobId || !sourceUrl || !jobDescription) return null

      return {
        title: normalizeWhitespace(record.title),
        company: 'Sasken',
        department: null,
        location,
        city,
        jobId,
        requisitionId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: extractExperience(record.jdText),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: dedupeSkills(record.jd_primary_skills, record.jd_secondary_skills),
        postingDate: toIsoDate(record.created_at),
        closingDate: null,
        jobDescription,
      }
    })
    .filter(Boolean)

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createSaskenScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize
      const payload = await fetchJson(buildListingUrl({ limit: pageSize, offset }), {
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body: buildListingFormData(),
      })
      const pageJobs = extractSearchResults(payload)

      if (pageJobs.length === 0) {
        break
      }

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          source: 'sasken',
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (pageJobs.length < pageSize) {
        break
      }
    }

    return jobs
  },
})

export const run = async () => createSaskenScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Sasken scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'sasken')
    console.log('DB result:', result)
    process.exit(0)
  }
}
