import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import { RELEVANTZ_TECHNOLOGY_SERVICES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORDPRESS_ORIGIN = PROVIDER_METADATA.wordpressOrigin
export const CAREERS_PAGE_SLUG = PROVIDER_METADATA.wordpressCareersPageSlug
export const CAREERS_PAGE_API_URL = PROVIDER_METADATA.wordpressCareersPageApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const APPLY_EMAIL_BY_TAB = {
  india: 'careers-india@relevantz.com',
  us: 'careers-us@relevantz.com',
  canada: 'canada@relevantz.com',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\s+/g, ' ')
  .trim()

const toTextLines = (html = '') => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|section|article|main|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const inferCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const primarySegment = normalized.split('/')[0] || normalized
  return normalizeWhitespace(primarySegment.split(',')[0]) || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^full\s*time$/i.test(normalized) || /^fulltime$/i.test(normalized)) return 'Full-time'
  if (/^part\s*time$/i.test(normalized) || /^parttime$/i.test(normalized)) return 'Part-time'
  if (/^contract$/i.test(normalized)) return 'Contract'
  if (/^permanent$/i.test(normalized)) return 'Permanent'
  return normalized
}

const splitSkills = (value) => normalizeWhitespace(value)
  .split(',')
  .map((item) => normalizeWhitespace(item))
  .filter(Boolean)

const normalizeAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractCareersPageRecord = (payload) => {
  const record = Array.isArray(payload) ? payload[0] : payload

  if (!record || typeof record !== 'object') return null
  if (!record.acf || typeof record.acf !== 'object') return null

  return record
}

export const hasOfficialCareersSignal = (payload) => {
  const record = extractCareersPageRecord(payload)
  if (!record) return false

  const title = normalizeWhitespace(record?.title?.rendered)
  const slug = normalizeWhitespace(record?.slug)
  const tabs = Array.isArray(record?.acf?.ju_location_tabs) ? record.acf.ju_location_tabs : []
  const tabLabels = tabs
    .map((tab) => normalizeWhitespace(tab?.label)?.toLowerCase())
    .filter(Boolean)
  const listings = Array.isArray(record?.acf?.ju_job_listings) ? record.acf.ju_job_listings : []
  const hiringBold = normalizeWhitespace(record?.acf?.ju_hiring_heading_bold)
  const hiringSubtitle = normalizeWhitespace(record?.acf?.ju_hiring_subtitle)

  return title === 'Join us page'
    && slug === CAREERS_PAGE_SLUG
    && tabLabels.includes('india')
    && tabLabels.includes('us')
    && tabLabels.includes('canada')
    && hiringBold === 'Hiring!'
    && hiringSubtitle === 'Find the perfect job for you'
    && listings.length > 0
}

const extractExperience = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    const match = normalized.match(/Experience:\s*([^|]+)/i)
    if (match) return normalizeWhitespace(match[1])
  }

  return null
}

const stripExperienceSuffix = (value) =>
  normalizeWhitespace(value).replace(/\|\s*Experience:\s*.+$/i, '').trim()

const extractRequiredSkills = (descriptionHtml = '') => {
  const lines = toTextLines(descriptionHtml)
  const skillsLine = lines.find((line) => /^(?:Skillsets Required|Skills Required)\s*:/i.test(line))
  if (!skillsLine) return []

  return splitSkills(skillsLine.replace(/^(?:Skillsets Required|Skills Required)\s*:\s*/i, ''))
}

const buildMailtoApplyUrl = ({ title, location, locationTab }) => {
  const key = normalizeWhitespace(locationTab).toLowerCase()
  const email = APPLY_EMAIL_BY_TAB[key] || APPLY_EMAIL_BY_TAB.us
  const subject = encodeURIComponent(`Application: ${title}`)
  const body = encodeURIComponent(
    `Hi,\n\nI would like to apply for the position: ${title}\nLocation: ${location}\n\nPlease find my details below:\n\n`,
  )

  return `mailto:${email}?subject=${subject}&body=${body}`
}

export const extractIndiaJobs = (payload) => {
  const record = extractCareersPageRecord(payload)
  if (!record) return []

  const listings = Array.isArray(record?.acf?.ju_job_listings) ? record.acf.ju_job_listings : []

  return listings
    .filter((job) => normalizeWhitespace(job?.job_location_tab).toLowerCase() === 'india')
    .map((job) => {
      const title = normalizeWhitespace(job?.job_title)
      const rawLocation = stripExperienceSuffix(job?.job_location)
      const employmentType = normalizeEmploymentType(stripExperienceSuffix(job?.job_type))
      const experienceRequired = extractExperience(job?.job_type, job?.job_location)
      const descriptionLines = toTextLines(job?.job_description)
      const description = normalizeWhitespace(descriptionLines.join(' ')) || title
      const requiredSkills = extractRequiredSkills(job?.job_description)
      const location = normalizeWhitespace(rawLocation)
      const slug = slugify(`${title}-${location}`)
      const applyUrl = normalizeAbsoluteUrl(job?.job_link)
        || buildMailtoApplyUrl({
          title,
          location,
          locationTab: job?.job_location_tab,
        })

      if (!title || !location) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city: inferCity(location),
        country: 'India',
        jobId: `${SOURCE}-${slug}`,
        requisitionId: slug,
        sourceUrl: CAREERS_URL,
        applyUrl,
        employmentType,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: description,
      }
    })
    .filter(Boolean)
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createRelevantzTechnologyServicesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const careersPayload = await fetchJson(CAREERS_PAGE_API_URL)
    if (!hasOfficialCareersSignal(careersPayload)) {
      throw new Error('The verified Relevantz Technology Services careers payload no longer matches the trusted first-party surface')
    }

    const jobs = extractIndiaJobs(careersPayload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createRelevantzTechnologyServicesScraper(options).run(options)

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
