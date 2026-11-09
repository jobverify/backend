import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'

import NOTION_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = NOTION_CATALOG
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const ASHBY_PUBLIC_BOARD_URL = PROVIDER_METADATA.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL = PROVIDER_METADATA.ashbyJobBoardUrl

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const getAddress = (location = {}) => (
  location?.address?.postalAddress || location?.address || {}
)

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

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Careers at Notion \| We(?:&#x27;|'|’)re Hiring!\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Careers at Notion')
    && normalized.includes('Open Positions')
    && normalized.includes('Hyderabad, India')
}

export const extractVerifiedAshbyPublicBoardUrl = (html = '') =>
  (
    /https:\/\/jobs\.ashbyhq\.com\/notion(?=["'<\s])/i.test(String(html ?? ''))
    || /https:\/\/jobs\.ashbyhq\.com\/notion\/[0-9a-f-]{8,}/i.test(String(html ?? ''))
  )
    ? ASHBY_PUBLIC_BOARD_URL
    : null

export const buildAshbyJobBoardUrl = (publicBoardUrl) => {
  try {
    const url = new URL(String(publicBoardUrl ?? ''))
    if (url.hostname !== 'jobs.ashbyhq.com') return null
    const slug = url.pathname.split('/').filter(Boolean)[0]
    return slug ? `https://api.ashbyhq.com/posting-api/job-board/${slug}` : null
  } catch {
    return null
  }
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
        company: PROVIDER_METADATA.companyName,
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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: PROVIDER_METADATA.source,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: PROVIDER_METADATA.source,
  timeoutMs: 15000,
})

export const createNotionScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verified Notion official careers page changed materially')
    }

    const verifiedPublicBoardUrl = extractVerifiedAshbyPublicBoardUrl(careersHtml)
    if (verifiedPublicBoardUrl !== ASHBY_PUBLIC_BOARD_URL) {
      throw new Error('Verified Ashby public board handoff changed materially')
    }

    const verifiedJobBoardUrl = buildAshbyJobBoardUrl(verifiedPublicBoardUrl)
    if (verifiedJobBoardUrl !== ASHBY_JOB_BOARD_URL) {
      throw new Error('Verified Ashby public board handoff changed materially')
    }

    const payload = await fetchJson(ASHBY_JOB_BOARD_URL)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('Verified Ashby payload changed materially')
    }

    return extractAshbyJobs(payload).map((job) => ({
      ...job,
      source: PROVIDER_METADATA.source,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createNotionScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, PROVIDER_METADATA.source)
}
