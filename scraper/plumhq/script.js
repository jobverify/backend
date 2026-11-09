import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { runKulaPublicApi } from '../../scraper-support/shared/kulaPublicApi.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { resolveKulaJobDescriptions } from '../../scraper-support/utils/kulaFlight.js'

import { PLUM_HQ_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = PLUM_HQ_CATALOG.companyName
export const SOURCE = PLUM_HQ_CATALOG.source
export const COUNTRY_FILTER = PLUM_HQ_CATALOG.countryFilter
export const CAREERS_URL = PLUM_HQ_CATALOG.officialCareersPageUrl
export const KULA_COMPANY_URL = PLUM_HQ_CATALOG.officialKulaCompanyUrl
export const KULA_JOBS_URL = PLUM_HQ_CATALOG.officialJobsBoardUrl
export const VERIFIED_ON = PLUM_HQ_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PLUM_HQ_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = PLUM_HQ_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EMPLOYMENT_TYPE_MAP = {
  full_time: 'Full-time',
  contract: 'Contract',
  internship: 'Internship',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/\b(\d+)\s*[-–]\s*(\d+)\s*years?\b/i)
  if (rangeMatch) return `${rangeMatch[1]} - ${rangeMatch[2]} years`

  const plusMatch = normalized.match(/\b(\d+)\+\s*years?\b/i)
  if (plusMatch) return `${plusMatch[1]}+ years`

  const exactMatch = normalized.match(/\b(\d+)\s*years?\b/i)
  if (exactMatch) return `${exactMatch[1]} years`

  return null
}

const toPublicJobUrl = (jobId) => `https://careers.kula.ai/plumhq/${jobId}/?jobs=true`

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /The new standard of health benefits, starts within/i.test(normalized)
    && /Welcome home/i.test(normalized)
    && /Check out our open roles/i.test(normalized)
}

export const extractEmbeddedKulaJobsUrl = (html) => {
  const match = String(html ?? '').match(
    /<iframe[^>]+src=["'](https:\/\/careers\.kula\.ai\/plumhq\?jobs=true)["'][^>]*>/i,
  )

  if (!match) return null

  try {
    return new URL(match[1]).toString()
  } catch {
    return null
  }
}

const parseEmbeddedJobs = (html) => {
  const serializedHtml = String(html ?? '')
  const patterns = [
    /\{\\"jobs\\":(\[.*?\]),\\"departments\\":/s,
    /\\"jobs\\":(\[.*?\]),\\"departments\\":/s,
    /"jobs":(\[.*?\]),"departments":/s,
  ]

  for (const pattern of patterns) {
    const match = serializedHtml.match(pattern)
    if (!match) continue

    try {
      return JSON.parse(
        match[1]
          .replace(/\\"/g, '"')
          .replace(/\\u0026/g, '&')
          .replace(/\\\\/g, '\\'),
      )
    } catch {
      return []
    }
  }

  return []
}

const isIndiaOffice = (office = {}) => {
  const country = normalizeWhitespace(office.country)
  if (country && /^india$/i.test(country)) return true

  const location = normalizeWhitespace(office.location || office.name)
  return Boolean(location && /(?:^|,\s*)india$/i.test(location))
}

const selectIndiaOffices = (offices = []) => {
  const explicitIndiaOffices = offices.filter(isIndiaOffice)
  if (!explicitIndiaOffices.length) return []

  const remoteOffices = offices.filter((office) => office?.remote && !explicitIndiaOffices.includes(office))
  return [...remoteOffices, ...explicitIndiaOffices]
}

const normalizeLocation = (offices = []) => {
  const uniqueLocations = [...new Set(
    offices
      .map((office) => normalizeWhitespace(
        office?.location
        || office?.name
        || (office?.remote ? 'Remote' : null),
      ))
      .filter(Boolean),
  )]

  return uniqueLocations.length ? uniqueLocations.join('; ') : null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^remote(?:\b|;)/i.test(normalized)) return 'Remote'
  return normalized.split(/[;,]/)[0]?.trim() || null
}

const inferCountry = (offices = []) => {
  for (const office of offices) {
    const country = normalizeWhitespace(office?.country)
    if (country) return country
  }

  return COUNTRY_FILTER
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  return EMPLOYMENT_TYPE_MAP[normalized] || null
}

const extractDescription = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^\$[0-9a-z]+$/i.test(normalized)) return null
  return normalized
}

const inferRemoteStatus = (offices = [], workplace = null) => {
  const normalizedWorkplace = normalizeWhitespace(workplace)?.toLowerCase() || ''
  const hasRemoteOffice = offices.some((office) => office?.remote)

  if (normalizedWorkplace.includes('hybrid')) return 'Hybrid'
  if (normalizedWorkplace.includes('remote') || hasRemoteOffice) return 'Remote'
  return 'On-site'
}

export const hasOfficialKulaJobDetailSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripHtml(page) || ''

  return /<title>\s*.+\s*-\s*Plum/i.test(page)
    && text.includes('India')
    && text.includes('Job type:')
  }

export const extractKulaJobDetail = (html = '', listing = {}) => {
  const text = stripHtml(html) || ''
  const experienceSnippet = text.match(
    /\b(?:\d+\s*[-–]\s*\d+\s*years?|\d+\+\s*years?|\d+\s*years?)\b[^.]{0,140}\bexperience\b/i,
  )?.[0]

  return {
    ...listing,
    experienceRequired: normalizeExperience(experienceSnippet) || listing.experienceRequired || null,
  }
}

export const enrichJobsWithKulaDetails = async (jobs, fetchText = defaultFetchText) => Promise.all(
  jobs.map(async (job) => {
    try {
      const detailHtml = await fetchText(job.sourceUrl)
      if (!hasOfficialKulaJobDetailSignal(detailHtml)) return job
      return extractKulaJobDetail(detailHtml, job)
    } catch {
      return job
    }
  }),
)

export const buildSearchUrl = () => KULA_JOBS_URL

export const mapKulaJobs = (rows) => (
  rows
    .map((row) => {
      if (row?.listed === false || String(row?.kind || '').toLowerCase() === 'internal') {
        return null
      }

      const title = normalizeWhitespace(row?.title)
      const jobId = normalizeWhitespace(row?.id)
      const offices = Array.isArray(row?.ats_job?.offices) ? row.ats_job.offices : []
      const indiaOffices = selectIndiaOffices(offices)
      const location = normalizeLocation(indiaOffices)
      const applyUrl = jobId ? toPublicJobUrl(jobId) : null

      if (!title || !jobId || !indiaOffices.length || !location || !applyUrl) {
        return null
      }

      return {
        title,
        company: COMPANY_NAME,
        department: normalizeWhitespace(row?.ats_job?.ats_department?.name),
        location,
        city: extractCity(location),
        country: inferCountry(indiaOffices),
        jobId,
        requisitionId: jobId,
        sourceUrl: applyUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(row?.ats_job?.employment_type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: extractDescription(row?.ats_job?.job_description),
        remoteStatus: inferRemoteStatus(indiaOffices, row?.ats_job?.workplace),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title))
)

export const extractSearchResults = (html) => mapKulaJobs(
  resolveKulaJobDescriptions(html, parseEmbeddedJobs(html)),
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPlumHqScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    if (!options.fetchText || options.fetchJson) return runKulaPublicApi({ source: 'plumhq', mapKulaJobs }, { maxJobs, ...options })
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Plum HQ careers page no longer matches the trusted public surface')
    }

    if (extractEmbeddedKulaJobsUrl(careersHtml) !== KULA_JOBS_URL) {
      throw new Error('The verified Plum HQ careers page no longer embeds the expected Kula board')
    }

    const listingHtml = await fetchText(buildSearchUrl())
    const jobs = extractSearchResults(listingHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const enrichedJobs = await enrichJobsWithKulaDetails(selectedJobs, fetchText)

    return enrichedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      sourceListingComplete: false,
      sourceDetailComplete: hasSourceDescription(job),
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPlumHqScraper().run(options)

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
