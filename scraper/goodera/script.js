import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { runKulaPublicApi } from '../../scraper-support/shared/kulaPublicApi.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { resolveKulaJobDescriptions } from '../../scraper-support/utils/kulaFlight.js'

import GOODERA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EMPLOYMENT_TYPE_MAP = {
  full_time: 'Full-time',
  contract: 'Contract',
  internship: 'Internship',
}

export const PROVIDER_METADATA = GOODERA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_US_URL = PROVIDER_METADATA.aboutUsUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const KULA_COMPANY_URL = PROVIDER_METADATA.officialKulaCompanyUrl
export const KULA_JOBS_URL = PROVIDER_METADATA.officialJobsBoardUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toPublicJobUrl = (jobId) => `https://careers.kula.ai/goodera/${jobId}/?jobs=true`

export const hasAboutUsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /At Goodera, we are on a mission to make social impact accessible to every team on the planet\./i.test(normalized)
    && /What does engineering have to do with volunteering\?/i.test(normalized)
    && /Goodera aims to be the Airbnb of employee volunteering/i.test(normalized)
    && /People of Goodera/i.test(normalized)
  }

export const hasContactPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /Contact Goodera/i.test(normalized)
    && /Looking to create meaningful volunteering experiences, design impactful social initiatives, or explore ways to engage your people with purpose\?/i.test(normalized)
    && /careers@goodera\.com/i.test(normalized)
    && /Find a job that you'll love|Find a job that you’ll love/i.test(normalized)
    && /© 2026 Goodera\. All rights reserved\./i.test(normalized)
  }

export const extractKulaCompanyUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/careers\.kula\.ai\/goodera\/?/i)
  if (!match) return null

  try {
    const url = new URL(match[0])
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export const hasOfficialKulaBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /(?:Work that powers the world of good\.|Powering the World of Good)/i.test(normalized)
    && /Open Positions/i.test(normalized)
    && /Explore our current job openings across various departments/i.test(normalized)
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

export const createGooderaScraper = () => ({
  async run(options = {}) {
    if (!options.fetchText || options.fetchJson) return runKulaPublicApi({ source: 'goodera', mapKulaJobs }, options)
    const { fetchText = defaultFetchText, now = () => new Date().toISOString() } = options
    const aboutHtml = await fetchText(ABOUT_US_URL)
    if (!hasAboutUsSignal(aboutHtml)) {
      throw new Error('The verified Goodera about page no longer matches the trusted first-party surface')
    }

    const contactHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasContactPageSignal(contactHtml)) {
      throw new Error('The verified Goodera contact page no longer matches the trusted first-party surface')
    }

    if (extractKulaCompanyUrl(contactHtml) !== KULA_COMPANY_URL) {
      throw new Error('The verified Goodera contact page no longer links to the expected Kula board')
    }

    const listingHtml = await fetchText(buildSearchUrl())
    if (!hasOfficialKulaBoardSignal(listingHtml)) {
      throw new Error('The verified Goodera Kula jobs board no longer matches the trusted public surface')
    }

    const jobs = extractSearchResults(listingHtml)
    if (jobs.length === 0) {
      throw new Error('The verified Goodera Kula jobs board no longer exposes India roles in the trusted public contract')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      sourceListingComplete: false,
      sourceDetailComplete: hasSourceDescription(job),
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createGooderaScraper().run(options)

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
