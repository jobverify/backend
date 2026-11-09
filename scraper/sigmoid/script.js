import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SIGMOID_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SIGMOID_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.officialCurrentOpeningsUrl
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl

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

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), 'https://www.sigmoid.com').toString()
  } catch {
    return null
  }
}

const normalizeDepartment = (value) => normalizeWhitespace(value)?.replace(/^\d+\s*:\s*/, '') || null

const getMetadataValue = (job = {}, name) => {
  const metadata = Array.isArray(job?.metadata) ? job.metadata : []
  const item = metadata.find((entry) => normalizeWhitespace(entry?.name) === name)
  return normalizeWhitespace(item?.value)
}

const trimExperienceNumber = (value) => normalizeWhitespace(value)?.replace(/\.0+$/, '') || null

const formatExperienceRange = (job = {}) => {
  const minValue = trimExperienceNumber(getMetadataValue(job, 'Min Work Experience'))
  const maxValue = trimExperienceNumber(getMetadataValue(job, 'Max Work Experience'))

  if (minValue && maxValue) return `${minValue}-${maxValue} years`
  if (minValue) return `${minValue}+ years`
  return null
}

const getLocationCandidates = (job = {}) => {
  const officeLocations = Array.isArray(job?.offices)
    ? job.offices.map((office) => normalizeWhitespace(office?.location)).filter(Boolean)
    : []

  return [
    normalizeWhitespace(job?.location?.name),
    ...officeLocations,
  ].filter((value, index, all) => value && all.indexOf(value) === index)
}

const isIndiaLocation = (value) => /\bIndia\b/i.test(normalizeWhitespace(value) || '')

const deriveDisplayLocation = (job = {}) =>
  getLocationCandidates(job).find((value) => isIndiaLocation(value)) || null

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  return {
    location: normalized,
    city: parts[0] || null,
    state: parts.length > 2 ? parts[1] : null,
    country: parts[parts.length - 1] || null,
  }
}

const normalizeGreenhouseAbsoluteUrl = (value, jobId) => {
  const normalizedId = normalizeWhitespace(jobId)
  if (!normalizedId) return null

  try {
    const url = new URL(String(value ?? ''))
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/g, '')

    if (hostname !== 'job-boards.greenhouse.io') return null
    if (pathname !== `/sigmoid/jobs/${normalizedId}`) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${normalizedId}`
  } catch {
    return null
  }
}

export const extractCurrentOpeningsUrl = (html = '') =>
  toAbsoluteUrl(String(html ?? '').match(/href=["']([^"']*\/careers\/current-openings\/?)["']/i)?.[1])

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers in data analytics and AI \| Sigmoid\s*<\/title>/i.test(page)
    && text.includes('Travel the upward curve towards a great data analytics career')
    && text.includes('Explore open roles')
    && extractCurrentOpeningsUrl(page) !== null
}

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Current Openings in Data, AI &amp; Analytics Careers \| Sigmoid\s*<\/title>/i.test(page)
    && /Current Openings/i.test(text)
    && /Apply Now/i.test(text)
    && page.includes('https://job-boards.greenhouse.io/sigmoid/jobs/')
    && page.includes(GREENHOUSE_JOBS_API_URL)
}

const getValidatedJobs = (payload) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Verified Sigmoid greenhouse payload changed materially')
  }

  for (const job of jobs) {
    const jobId = normalizeWhitespace(job?.id)
    const title = normalizeWhitespace(job?.title)
    const absoluteUrl = normalizeGreenhouseAbsoluteUrl(job?.absolute_url, jobId)

    if (!jobId || !title || !absoluteUrl) {
      throw new Error('Verified Sigmoid greenhouse payload changed materially')
    }
  }

  return jobs
}

export const extractIndiaJobsFromGreenhousePayload = (payload) => getValidatedJobs(payload)
  .map((job) => {
    const location = deriveDisplayLocation(job)
    if (!location) return null

    const locationData = parseLocation(location)
    const jobId = normalizeWhitespace(job?.id)

    return {
      title: normalizeWhitespace(job?.title),
      company: COMPANY,
      department: getMetadataValue(job, 'Department Category')
        || normalizeDepartment(job?.departments?.[0]?.name),
      location: locationData.location,
      city: locationData.city,
      state: locationData.state,
      country: locationData.country,
      jobId,
      requisitionId: normalizeWhitespace(job?.requisition_id) || jobId,
      sourceUrl: normalizeGreenhouseAbsoluteUrl(job?.absolute_url, jobId),
      applyUrl: normalizeGreenhouseAbsoluteUrl(job?.absolute_url, jobId),
      employmentType: getMetadataValue(job, 'Employment Type'),
      experienceRequired: formatExperienceRange(job),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job?.first_published || job?.updated_at),
      closingDate: normalizeWhitespace(job?.application_deadline),
      jobDescription: normalizeWhitespace(job?.content) || null,
      remoteStatus: 'On-site',
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
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

export const createSigmoidScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified official Sigmoid careers page')
    }

    if (!sameUrl(extractCurrentOpeningsUrl(careersHtml), CURRENT_OPENINGS_URL)) {
      throw new Error('The verified Sigmoid careers handoff changed materially')
    }

    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)
    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('Response is not the verified Sigmoid current openings page')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(GREENHOUSE_JOBS_API_URL),
    )
    const selectedJobs = Number.isInteger(maxJobs) && maxJobs > 0
      ? jobs.slice(0, maxJobs)
      : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSigmoidScraper(options).run(options)

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
