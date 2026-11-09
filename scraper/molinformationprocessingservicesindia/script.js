import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId
export const DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const PUBLIC_PORTAL_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const parseIndiaLocation = (location) => {
  const parts = String(location ?? '')
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const country = /india/i.test(parts[parts.length - 1] || '') ? 'India' : null
  const state = parts.length >= 2 ? parts[parts.length - 2] : null
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[0]

  return {
    location: [city, state, country].filter(Boolean).join(', ') || null,
    city,
    state: state && city && state.toLowerCase() === city.toLowerCase() ? null : state,
    country,
  }
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/molit\.darwinbox\.in\/ms\/candidate\/careers/i)
  return normalizeWhitespace(match?.[0])
}

export const hasOfficialMolItCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''
  const title = extractTitle(page)

  return ['Careers at MOL-IT', 'MOL IT | Careers @ MOL IT'].includes(title)
    && text.includes('Careers at MOL-IT')
    && text.includes('Join Our Team')
    && text.includes('Current Vacancies')
    && (
      text.includes('Find your next role and grow with us.')
      || text.includes('Reimagine Your Future')
    )
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeDarwinboxJobs = (jobs = [], scrapedAt) => jobs.map((job) => {
  const locationDetails = parseIndiaLocation(job.location)

  return {
    ...job,
    location: locationDetails.location || job.location,
    city: locationDetails.city || job.city,
    state: locationDetails.state || null,
    country: locationDetails.country || job.country || 'India',
    scrapedAt,
  }
})

export const createMolInformationProcessingServicesIndiaScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialMolItCareersSignals(careersHtml)) {
      throw new Error('Mol Information Processing Services India verified official careers page no longer matches the verified public surface')
    }

    const jobs = await darwinboxScraper.run({
      maxPages,
      maxJobs,
      fetchListingPage,
    })
    const scrapedAt = now()

    return normalizeDarwinboxJobs(jobs, scrapedAt)
  },
})

export const run = async (options = {}) => createMolInformationProcessingServicesIndiaScraper(options).run(options)

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
