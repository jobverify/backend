import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CAREERS_PAGE_URL = 'https://www.techolution.com/careers/'
export const LISTING_API_URL = 'https://hire.techolution.com/backend/Roles/careers'

const DETAIL_API_BASE_URL = 'https://hire.techolution.com/backend/Roles/jobData'
const APPLY_URL_BASE = 'https://hire.techolution.com/video-resume'
const COMPANY_NAME = 'Techolution'
const SOURCE = 'techolution'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeText(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/span|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeText(value)?.toLowerCase()
  if (!normalized) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeText(value)
}

const normalizeDate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized
  return parsed.toISOString().slice(0, 10)
}

const extractCity = (location) => {
  const normalized = normalizeText(location)
  if (!normalized || /^remote\b/i.test(normalized)) return null
  return normalizeText(normalized.split(',')[0])
}

const isIndiaLocation = (value) => /\bindia\b/i.test(normalizeText(value) || '')

const unique = (values) => {
  const seen = new Set()

  return values.filter((value) => {
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const extractRequiredSkills = (skills = {}) => unique([
  ...(Array.isArray(skills?.foundationalSkills) ? skills.foundationalSkills : []),
  ...(Array.isArray(skills?.advancedSkills) ? skills.advancedSkills : []),
].map((value) => normalizeText(value)).filter(Boolean))

const buildDescriptionFromSections = (jobDescription = {}) => {
  const sections = Array.isArray(jobDescription?.placement) && jobDescription.placement.length > 0
    ? jobDescription.placement
    : Object.keys(jobDescription || {})

  const description = sections
    .map((key) => stripHtml(jobDescription?.[key]))
    .filter(Boolean)
    .join('\n\n')

  return description || null
}

export const buildDetailApiUrl = (roleId) => {
  const normalizedRoleId = normalizeText(roleId)
  if (!normalizedRoleId) return null
  return `${DETAIL_API_BASE_URL}?id=${encodeURIComponent(normalizedRoleId)}`
}

export const buildApplyUrl = (roleId) => {
  const normalizedRoleId = normalizeText(roleId)
  if (!normalizedRoleId) return null
  return `${APPLY_URL_BASE}?role=${encodeURIComponent(normalizedRoleId)}`
}

const flattenRoleRecords = (payload = {}) => (
  Array.isArray(payload?.data) ? payload.data : []
).flatMap((group) => {
  const department = normalizeText(group?.category)
  const roles = Array.isArray(group?.roles) ? group.roles : []

  return roles.map((role) => ({ role, department }))
})

export const extractIndiaJobs = (payload) => flattenRoleRecords(payload)
  .filter(({ role }) => normalizeText(role?.status) === 'published' && isIndiaLocation(role?.locations))
  .map(({ role, department }) => {
    const title = normalizeText(role?.roleName)
    const jobId = normalizeText(role?.id)
    const location = normalizeText(role?.locations)
    const applyUrl = buildApplyUrl(jobId)
    const requiredSkills = extractRequiredSkills(role?.skills)
    const jobDescription = stripHtml(role?.roleDescription)

    if (!title || !jobId || !location || !applyUrl) return null

    return {
      title,
      company: COMPANY_NAME,
      department,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: normalizeEmploymentType(role?.employmentType),
      experienceRequired: normalizeText(role?.positionStatus),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: normalizeDate(role?.createdAt),
      closingDate: null,
      jobDescription,
      publicExperienceChecked: Boolean(jobDescription || requiredSkills.length > 0),
    }
  })
  .filter(Boolean)

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detail = payload?.details ?? {}
  const jobId = normalizeText(listing?.jobId || detail?.id)
  const applyUrl = buildApplyUrl(jobId) || listing?.applyUrl || listing?.sourceUrl || null
  const requiredSkills = extractRequiredSkills(detail?.skills)
  const jobDescription = buildDescriptionFromSections(detail?.jobDescription) || listing?.jobDescription || null

  return {
    ...listing,
    title: normalizeText(detail?.roleName) || listing?.title || null,
    department: normalizeText(detail?.category) || listing?.department || null,
    location: normalizeText(detail?.location) || listing?.location || null,
    city: extractCity(detail?.location) || listing?.city || null,
    jobId: jobId || listing?.jobId || null,
    requisitionId: jobId || listing?.requisitionId || null,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: normalizeEmploymentType(detail?.employmentType) || listing?.employmentType || null,
    experienceRequired: normalizeText(detail?.positionStatus) || listing?.experienceRequired || null,
    minimumQualification: listing?.minimumQualification || null,
    preferredQualification: listing?.preferredQualification || null,
    requiredSkills: requiredSkills.length > 0 ? requiredSkills : listing?.requiredSkills || [],
    postingDate: normalizeDate(detail?.createdAt) || listing?.postingDate || null,
    closingDate: listing?.closingDate || null,
    jobDescription,
    publicExperienceChecked: Boolean(
      jobDescription
      || (requiredSkills.length > 0 ? requiredSkills : listing?.requiredSkills || []).length > 0,
    ),
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createTecholutionScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const payload = await fetchJson(LISTING_API_URL)
    if (!Array.isArray(payload?.data)) {
      throw new Error('Techolution careers API no longer returns the verified category feed')
    }

    const listings = extractIndiaJobs(payload)
    const selectedListings = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings

    const detailedJobs = await Promise.all(selectedListings.map(async (listing) => {
      try {
        const detailPayload = await fetchJson(buildDetailApiUrl(listing.jobId))
        return extractJobDetail(detailPayload, listing)
      } catch {
        return listing
      }
    }))

    const scrapedAt = now()

    return detailedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = (options) => createTecholutionScraper().run(options)

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
