import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.squareyards.com/career'
export const DEPARTMENT_PATHS = [
  'Sales',
  'Technology',
  'Human_Resources',
  'Customer_Relations',
  'Interior_Company',
]

const APPLY_BASE_URL = 'https://www.squareyards.com/career_form'
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
  return firstPart || normalized
}

const toDepartmentPath = (value) => normalizeWhitespace(value)?.replace(/\s+/g, '_') || null

const toApplyQueryValue = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return encodeURIComponent(normalized.replace(/\s+/g, '_'))
}

const extractRequiredSkills = (record, descriptionHtml) => {
  const explicitSkills = record?.requiredSkills || record?.skills || record?.skillSet
  if (Array.isArray(explicitSkills)) {
    return explicitSkills.map((value) => normalizeWhitespace(value)).filter(Boolean)
  }

  return [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
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

export const buildDepartmentUrl = (departmentPath) => `${CAREERS_URL}/${departmentPath}`

export const buildDepartmentUrls = (departmentPaths = DEPARTMENT_PATHS) => departmentPaths.map((departmentPath) => buildDepartmentUrl(departmentPath))

export const buildApplyUrl = ({ jobId, location, department }) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  const locationParam = toApplyQueryValue(location)
  const departmentParam = toApplyQueryValue(department)

  if (!normalizedJobId || !locationParam || !departmentParam) return null

  return `${APPLY_BASE_URL}/${normalizedJobId}?location=${locationParam}&dept=${departmentParam}`
}

export const extractListings = (payload, departmentPath = null) => extractListingRecords(payload)
  .map((record) => {
    const title = normalizeWhitespace(getField(record, [
      'title',
      'jobTitle',
      'job_title',
      'position',
      'role',
    ]))
    const jobId = normalizeWhitespace(getField(record, [
      'id',
      'jobId',
      'job_id',
      'requisitionId',
      'requisition_id',
    ]))
    const department = normalizeWhitespace(getField(record, [
      'department',
      'dept',
      'team',
      'category',
    ]))
    const location = normalizeWhitespace(getField(record, [
      'location',
      'jobLocation',
      'job_location',
      'city',
    ]))
    const descriptionHtml = getField(record, [
      'description',
      'jobDescription',
      'job_description',
      'details',
      'content',
    ]) || ''
    const sourceUrl = departmentPath ? buildDepartmentUrl(departmentPath) : buildDepartmentUrl(toDepartmentPath(department) || '')
    const applyUrl = buildApplyUrl({
      jobId,
      location,
      department,
    })

    if (!title || !jobId || !department || !location || !applyUrl) return null

    return {
      title,
      company: 'Squareyards',
      department,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl,
      employmentType: normalizeWhitespace(getField(record, [
        'employmentType',
        'employment_type',
        'jobType',
        'job_type',
        'type',
      ])) || null,
      experienceRequired: normalizeWhitespace(getField(record, [
        'experience',
        'experienceRequired',
        'jobExperience',
        'job_experience',
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
        'posted_on',
        'postedOn',
        'postingDate',
        'date',
      ])),
      closingDate: toDateOnly(getField(record, [
        'closingDate',
        'closing_date',
        'deadline',
      ])),
      jobDescription: stripTags(descriptionHtml),
    }
  })
  .filter(Boolean)

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchDepartmentListings = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      Referer: CAREERS_URL,
    },
    signal: createTimeoutSignal(timeoutMs),
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

export const createSquareyardsScraper = ({
  departmentPaths = DEPARTMENT_PATHS,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const fetchDepartmentListings = options.fetchDepartmentListings || defaultFetchDepartmentListings
    const selectedNow = options.now || now
    const dedupedJobs = new Map()

    for (const departmentPath of departmentPaths) {
      const url = buildDepartmentUrl(departmentPath)
      const payload = await fetchDepartmentListings(url)
      const jobs = extractListings(payload, departmentPath)

      for (const job of jobs) {
        if (!dedupedJobs.has(job.jobId)) {
          dedupedJobs.set(job.jobId, job)
        }
      }
    }

    const jobs = [...dedupedJobs.values()]
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'squareyards',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: selectedNow(),
    }))
  },
})

export const run = async (options = {}) => createSquareyardsScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Squareyards scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal Squareyards jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'squareyards')
    console.log('DB result:', result)
    process.exit(0)
  }
}
