import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { HINGE_HEALTH_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = HINGE_HEALTH_INDIA_CATALOG.source
export const COMPANY = HINGE_HEALTH_INDIA_CATALOG.companyName
export const VERIFIED_ON = HINGE_HEALTH_INDIA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = HINGE_HEALTH_INDIA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = HINGE_HEALTH_INDIA_CATALOG
export const CULTURE_PAGE_URL = HINGE_HEALTH_INDIA_CATALOG.officialCulturePageUrl
export const ASHBY_PUBLIC_BOARD_URL = HINGE_HEALTH_INDIA_CATALOG.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL = HINGE_HEALTH_INDIA_CATALOG.ashbyJobBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|td|th|tr)>/gi, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => (normalizeWhitespace(value) || '').toLowerCase()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const getAddress = (location = {}) => location?.address?.postalAddress || location?.address || {}

const toLocationCandidate = (location = {}) => {
  const address = getAddress(location)
  const city = normalizeWhitespace(address?.addressLocality)
  const state = normalizeWhitespace(address?.addressRegion)
  const country = normalizeWhitespace(address?.addressCountry)
  const label = normalizeWhitespace(location?.location)

  return {
    location: [city, state, country].filter(Boolean).join(', ') || label,
    city,
    state,
    country,
  }
}

const selectIndiaLocation = (job = {}) => {
  const candidates = [
    toLocationCandidate({ location: job.location, address: job.address }),
    ...(Array.isArray(job.secondaryLocations) ? job.secondaryLocations : []).map(toLocationCandidate),
  ].filter((candidate) => candidate.location)

  return candidates.find((candidate) => filterIndiaJobs([candidate]).length > 0) || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCulturePageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title[^>]*>\s*Culture\s*(?:&|&amp;)\s*Engagement\s*\|\s*Hinge Health\s*<\/title>/i.test(page)
    && /https:\/\/jobs\.ashbyhq\.com\/hinge-health\b/i.test(page)
    && (
      normalized.includes('people-first. culture-forward. always learning.')
      || normalized.includes('moving people beyond pain')
    )
}

export const extractVerifiedAshbyPublicBoardUrl = (html) => {
  const match = String(html ?? '').match(/https:\/\/jobs\.ashbyhq\.com\/hinge-health\b/i)
  return match ? match[0] : null
}

export const buildAshbyJobBoardUrl = (publicBoardUrl) => {
  const match = String(publicBoardUrl ?? '').match(/jobs\.ashbyhq\.com\/([^/?#]+)/i)
  return match ? `https://api.ashbyhq.com/posting-api/job-board/${match[1]}` : null
}

export const extractAshbyJobs = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const selectedLocation = selectIndiaLocation(job)
      if (!selectedLocation) return null

      return {
        title: normalizeWhitespace(job?.title),
        company: COMPANY,
        department: normalizeWhitespace(job?.department),
        location: selectedLocation.location,
        city: selectedLocation.city,
        state: selectedLocation.state,
        country: selectedLocation.country,
        jobId: normalizeWhitespace(job?.id),
        requisitionId: normalizeWhitespace(job?.id),
        sourceUrl: normalizeWhitespace(job?.jobUrl),
        applyUrl: normalizeWhitespace(job?.applyUrl),
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.publishedAt),
        closingDate: null,
        jobDescription: String(job?.descriptionHtml ?? '').trim() || null,
      }
    })
    .filter((job) => job?.title && job.jobId && job.sourceUrl && job.applyUrl)

export const createHingeHealthIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const culturePageHtml = await fetchText(CULTURE_PAGE_URL)
    if (!hasOfficialCulturePageSignal(culturePageHtml)) {
      throw new Error(
        'The verified Hinge Health India official culture page no longer matches the trusted public surface',
      )
    }

    const publicBoardUrl = extractVerifiedAshbyPublicBoardUrl(culturePageHtml)
    if (publicBoardUrl !== ASHBY_PUBLIC_BOARD_URL) {
      throw new Error('The verified Ashby public board handoff no longer matches the trusted Hinge Health surface')
    }

    const jobBoardUrl = buildAshbyJobBoardUrl(publicBoardUrl)
    if (jobBoardUrl !== ASHBY_JOB_BOARD_URL) {
      throw new Error('The verified Hinge Health India Ashby job-board URL no longer matches the trusted public surface')
    }

    const payload = await fetchJson(jobBoardUrl)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('The verified Ashby payload no longer exposes the expected jobs array')
    }

    const jobs = extractAshbyJobs(payload)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createHingeHealthIndiaScraper(options).run(options)

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
