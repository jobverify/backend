import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import { TOMTOM_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const OFFICIAL_PUNE_OFFICE_URL = PROVIDER_METADATA.officialPuneOfficeUrl
export const LEVER_BOARD_URL = PROVIDER_METADATA.officialLeverBoardUrl
export const LEVER_API_URL = PROVIDER_METADATA.leverApiUrl
export const OFFICIAL_PUNE_JOBS_OVERVIEW_URL = new URL(
  '/careers/joboverview/?location=Pune,+India',
  OFFICIAL_CAREERS_URL,
).toString()
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: JSON_HEADERS,
  label: SOURCE,
})

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'

  return normalized.split(/\s+\|\s+|,\s*/)[0] || null
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const isIndiaJob = (job) => [
  normalizeWhitespace(job?.categories?.location),
  ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []).map(normalizeWhitespace),
  normalizeWhitespace(job?.country),
].some((value) => /(^|[\s,(|-])india\b/i.test(value || ''))

export const hasOfficialTomTomCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*TomTom Careers\s*<\/title>/i.test(page)
    && text.includes('engineer the first real-time map')
    && text.includes('find your place in the world')
    && /(?:https:\/\/www\.tomtom\.com)?\/careers\/joboverview\/?/i.test(page)
    && /(?:https:\/\/www\.tomtom\.com)?\/careers\/offices\/pune\/?/i.test(page)
}

export const hasOfficialTomTomPuneOfficeSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Pune Office \| TomTom Careers\s*<\/title>/i.test(page)
    && text.includes('pune, india')
    && text.includes('tomtom india pvt ltd')
    && text.includes('yerwada, pune 411006')
    && text.includes('see jobs')
    && /(?:https:\/\/www\.tomtom\.com)?\/careers\/joboverview\/\?location=Pune(?:%2C|,)(?:\+|%20)India/i.test(page)
}

export const hasOfficialTomTomPuneJobsOverviewSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Jobs \| TomTom Careers\s*<\/title>/i.test(page)
    && text.includes('refine your search')
    && text.includes('location')
    && text.includes('team')
    && text.includes('no filters were applied')
    && text.includes('loading job results...')
}

export const hasOfficialLeverBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*TomTom\s*<\/title>/i.test(page)
    && /job openings at tomtom/i.test(page)
    && text.includes('location type')
    && text.includes('location')
    && text.includes('team')
    && text.includes('work type')
    && /https?:\/\/(?:www\.)?tomtom\.com\/careers/i.test(page)
    && /https:\/\/jobs\.eu\.lever\.co\/tomtom\/[^"'?#\s<]+/i.test(page)
}

export const extractIndiaLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('TomTom Lever postings payload no longer returns an array')
  }

  return leverJobs
    .filter(isIndiaJob)
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl)
      const jobId = normalizeWhitespace(job?.id)

      if (!title || !location || !sourceUrl || !jobId) {
        throw new Error('TomTom Lever postings payload no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location,
        city: extractCity(location),
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.descriptionPlain),
      }
    })
}

export const createTomTomScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersPage = await fetchPage(OFFICIAL_CAREERS_URL)
    if (
      Number(careersPage.status) !== 200
      || !sameUrl(careersPage.url, OFFICIAL_CAREERS_URL)
      || !hasOfficialTomTomCareersSignals(careersPage.html)
    ) {
      throw new Error('TomTom verified official careers surface changed materially')
    }

    const puneOfficePage = await fetchPage(OFFICIAL_PUNE_OFFICE_URL)
    if (
      Number(puneOfficePage.status) !== 200
      || !sameUrl(puneOfficePage.url, OFFICIAL_PUNE_OFFICE_URL)
      || !hasOfficialTomTomPuneOfficeSignals(puneOfficePage.html)
    ) {
      throw new Error('TomTom verified Pune office careers surface changed materially')
    }

    const puneJobsOverviewPage = await fetchPage(OFFICIAL_PUNE_JOBS_OVERVIEW_URL)
    if (
      Number(puneJobsOverviewPage.status) !== 200
      || !sameUrl(puneJobsOverviewPage.url, OFFICIAL_PUNE_JOBS_OVERVIEW_URL)
      || !hasOfficialTomTomPuneJobsOverviewSignals(puneJobsOverviewPage.html)
    ) {
      throw new Error('TomTom verified Pune jobs-overview surface changed materially')
    }

    const leverBoardPage = await fetchPage(LEVER_BOARD_URL)
    if (
      Number(leverBoardPage.status) !== 200
      || !sameUrl(leverBoardPage.url, LEVER_BOARD_URL)
      || !hasOfficialLeverBoardSignal(leverBoardPage.html)
    ) {
      throw new Error('TomTom verified public Lever board changed materially')
    }

    const scrapedAt = now()

    return extractIndiaLeverJobs(await fetchJson(LEVER_API_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createTomTomScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
