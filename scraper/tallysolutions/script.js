import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://tallysolutions.com/careers/opportunities/'
export const LISTING_URL = 'https://tallysolutions.com/wp-content/themes/tally/api/api-careers-job-listing.php'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const getField = (record, keys) => {
  for (const key of keys) {
    const value = record?.[key]
    if (value == null) continue
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }

  return null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const toDateOnly = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const [firstPart] = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  if (!firstPart || /^india$/i.test(firstPart)) return null
  return firstPart
}

const isIndiaLocation = ({ country, location }) => {
  if (/^india$/i.test(normalizeWhitespace(country) || '')) return true
  return /\bindia\b/i.test(normalizeWhitespace(location) || '')
}

const extractRequiredSkills = (record, descriptionHtml) => {
  const explicitSkills = record?.requiredSkills || record?.skills || record?.skillSet
  if (Array.isArray(explicitSkills)) {
    return explicitSkills.map((value) => normalizeWhitespace(value)).filter(Boolean)
  }

  const listItems = [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return listItems
}

const extractListingRecords = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload == null) return []

  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (!trimmed) return []

    try {
      return extractListingRecords(JSON.parse(trimmed))
    } catch {
      return []
    }
  }

  const candidates = [
    payload.data,
    payload.jobs,
    payload.results,
    payload.records,
    payload.openings,
    payload.response,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

export const buildListingUrl = () => LISTING_URL

export const buildListingRequestBody = ({
  companySelector = '',
  countrySelector = '',
  departmentSelector = '',
} = {}) => new URLSearchParams({
  companySelector,
  countrySelector,
  departmentSelector,
}).toString()

export const extractListings = (payload) => extractListingRecords(payload)
  .map((record) => {
    const title = normalizeWhitespace(getField(record, [
      'jobTitle',
      'job_title',
      'title',
      'position',
      'role',
    ]))
    const country = normalizeWhitespace(getField(record, [
      'country',
      'jobCountry',
      'job_country',
      'countryName',
    ])) || null
    const location = normalizeWhitespace(getField(record, [
      'jobLocation',
      'job_location',
      'location',
      'locationName',
    ]))
    const descriptionHtml = getField(record, [
      'description',
      'jobDescription',
      'job_description',
      'details',
      'content',
    ]) || ''
    const jobId = normalizeWhitespace(getField(record, [
      'jobId',
      'job_id',
      'requisitionId',
      'requisition_id',
      'jobCode',
      'job_code',
      'id',
    ])) || slugify(title)

    if (!title || !jobId) return null

    const listing = {
      title,
      company: 'Tally Solutions',
      department: normalizeWhitespace(getField(record, [
        'department',
        'jobDepartment',
        'job_department',
        'team',
      ])) || null,
      location: location || country || null,
      city: extractCity(location),
      country: country || (/\bindia\b/i.test(location || '') ? 'India' : null),
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: CAREER_PAGE_URL,
      employmentType: normalizeWhitespace(getField(record, [
        'employmentType',
        'employment_type',
        'jobType',
        'job_type',
      ])) || null,
      experienceRequired: normalizeWhitespace(getField(record, [
        'experience',
        'jobExperience',
        'job_experience',
        'experienceRequired',
      ])) || null,
      minimumQualification: normalizeWhitespace(getField(record, [
        'minimumQualification',
        'minimum_qualification',
      ])) || null,
      preferredQualification: normalizeWhitespace(getField(record, [
        'preferredQualification',
        'preferred_qualification',
      ])) || null,
      requiredSkills: extractRequiredSkills(record, descriptionHtml),
      postingDate: toDateOnly(getField(record, [
        'postedOn',
        'postingDate',
        'jobPostedDate',
        'posted_at',
      ])),
      closingDate: toDateOnly(getField(record, [
        'closingDate',
        'closing_date',
        'deadline',
      ])),
      jobDescription: stripTags(descriptionHtml),
    }

    if (!listing.location || !isIndiaLocation(listing)) return null

    return listing
  })
  .filter(Boolean)

const defaultFetchListings = async ({ url, body }) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/javascript,*/*;q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: CAREER_PAGE_URL,
      Origin: 'https://tallysolutions.com',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const createTallySolutionsScraper = ({
  maxJobs = null,
  requestFilters = {},
} = {}) => ({
  async run(options = {}) {
    const fetchListings = options.fetchListings || defaultFetchListings
    const payload = await fetchListings({
      url: buildListingUrl(),
      body: buildListingRequestBody(requestFilters),
    })
    const jobs = extractListings(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'tallysolutions',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createTallySolutionsScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Tally Solutions scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'tallysolutions')
    console.log('DB result:', result)
    process.exit(0)
  }
}
