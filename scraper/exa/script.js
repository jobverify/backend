import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import EXA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EXA_CATALOG.source
export const COMPANY = EXA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EXA_CATALOG.officialBrandName
export const VERIFIED_ON = EXA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EXA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = EXA_CATALOG
export const HOMEPAGE_URL = EXA_CATALOG.officialHomepageUrl
export const CAREERS_URL = EXA_CATALOG.companyCareerPage
export const CAREERS_BUNDLE_URL = EXA_CATALOG.verifiedCareersBundleUrl
export const ASHBY_PUBLIC_BOARD_URL = EXA_CATALOG.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL = EXA_CATALOG.ashbyJobBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const getAddress = (location = {}) => location?.address?.postalAddress || location?.address || {}

const toLocationCandidate = (location = {}) => {
  const address = getAddress(location)
  const label = normalizeString(location?.location)
  const city = normalizeString(address?.addressLocality)
  const state = normalizeString(address?.addressRegion)
  const country = normalizeString(address?.addressCountry)

  return {
    location: label || [city, state, country].filter(Boolean).join(', '),
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

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && normalized.includes('come build the best search engine in the world')
    && normalized.includes('visa sponsorship')
    && normalized.includes('fully in-person team')
    && normalized.includes('exa labs inc.')
}

export const extractVerifiedCareersBundleUrl = (html) => {
  const match = String(html ?? '').match(
    /src=["']([^"']*\/_next\/static\/chunks\/app\/careers\/page-[a-z0-9]+\.js)["']/i,
  )

  if (!match) return null

  return new URL(match[1], CAREERS_URL).toString()
}

export const hasVerifiedCareersBundleSignal = (scriptText) => {
  const text = String(scriptText ?? '')

  return /jobs\.ashbyhq\.com\/exa/i.test(text)
    && !/jobs\.ashbyhq\.com\/(?!exa(?:\/|["']))/i.test(text)
    && /SF:"San Francisco"/i.test(text)
    && /NYC:"New York(?: City)?"/i.test(text)
    && /SG:"Singapore"/i.test(text)
    && !/\b(?:Bangalore|Bengaluru|India)\b/i.test(text)
}

export const extractAshbyJobs = (payload = {}) => (
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeString(job?.title)
      const jobId = normalizeString(job?.id)
      const sourceUrl = normalizeString(job?.jobUrl)
      const applyUrl = normalizeString(job?.applyUrl)
      const selectedLocation = selectIndiaLocation(job)

      if (!title || !jobId || !sourceUrl || !applyUrl || !selectedLocation) return null

      return {
        title,
        company: COMPANY,
        department: normalizeString(job?.department),
        location: selectedLocation.location,
        city: selectedLocation.city,
        state: selectedLocation.state,
        country: selectedLocation.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeString(job?.publishedAt),
        closingDate: null,
        jobDescription: normalizeString(job?.descriptionHtml),
      }
    })
    .filter(Boolean)
)

export const createExaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Exa verified first-party careers page no longer matches the known public surface')
    }

    const verifiedBundleUrl = extractVerifiedCareersBundleUrl(careersHtml)
    if (!verifiedBundleUrl) {
      throw new Error('Exa verified careers bundle handoff changed')
    }

    const bundleScript = await fetchText(verifiedBundleUrl)
    if (!hasVerifiedCareersBundleSignal(bundleScript)) {
      throw new Error('Exa verified careers bundle no longer matches the known Ashby handoff')
    }

    const payload = await fetchJson(ASHBY_JOB_BOARD_URL)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('Exa public Ashby job-board payload no longer exposes the verified jobs array')
    }

    return extractAshbyJobs(payload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createExaScraper(options).run(options)

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
