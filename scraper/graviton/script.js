import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { GRAVITON_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GRAVITON_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EMBEDDED_JOBS_PAGE_URL = PROVIDER_METADATA.embeddedJobsPageUrl
export const FIRST_PARTY_JOBS_JSON_URL = PROVIDER_METADATA.firstPartyJobsJsonUrl
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/Â/g, '')
    .replace(/â/g, "'")
    .replace(/â|â/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const chooseIndiaLocation = (job = {}) => {
  const rawCandidates = [
    job?.location_text,
    job?.office,
    job?.details?.location_text,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/\s*;\s*/g))
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)

  const indiaCandidate = rawCandidates.find((value) =>
    /(?:^|,\s*)India(?:$|[\s,)(-])/i.test(value)
    || getValidIndiaCityForJob({ location: value }),
  )

  return indiaCandidate || null
}

const deriveCity = (location) => {
  const scopedCity = getValidIndiaCityForJob({ location })
  if (scopedCity && scopedCity !== 'Remote') return scopedCity

  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = (job = {}, location) => {
  const haystack = [
    location,
    job?.details?.description_text,
    job?.details?.description_html,
  ]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  return 'On-site'
}

export const buildFirstPartyJobsJsonUrl = () => FIRST_PARTY_JOBS_JSON_URL

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Work with us - Graviton\s*<\/title>/i.test(page)
    && /At Graviton, we are looking for talented individuals/i.test(page)
    && /title=["']Current job openings["']/i.test(page)
    && /src=["']greenhouse-embed-local\.html["']/i.test(page)
}

export const hasVerifiedEmbeddedJobsSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Current Job Openings\s*<\/title>/i.test(page)
    && /Graviton Research Capital LLP/i.test(page)
    && /id=["']gh-board["']/i.test(page)
    && /javascripts\/greenhouse-embed-local\.js/i.test(page)
}

export const extractIndiaJobsFromFirstPartyPayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  const board = payload?.board

  if (!jobs || !board) {
    throw new Error('Graviton first-party jobs JSON no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const location = chooseIndiaLocation(job)
      const link = normalizeWhitespace(job?.details?.url || job?.url)
      const title = normalizeWhitespace(job?.title)
      const department = normalizeWhitespace(job?.department || board?.departments?.[job?.department_id])
      const jobDescription = normalizeWhitespace(job?.details?.description_text)

      if (!location || !link || !title) {
        throw new Error('Graviton first-party jobs JSON no longer exposes the expected public job fields')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location),
        country: 'India',
        link,
        applyUrl: link,
        sourceUrl: link,
        source: SOURCE,
        jobId: normalizeWhitespace(job?.gh_jid),
        requisitionId: null,
        department,
        employmentType: null,
        experienceRequired: null,
        jobDescription,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.details?.fetched_at || job?.details?.meta?.['og:url']),
        remoteStatus: inferRemoteStatus(job, location),
        scrapedAt,
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: EMBEDDED_JOBS_PAGE_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createGravitonScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Graviton verified careers page no longer matches the official first-party surface')
    }

    const embeddedJobsHtml = await fetchText(EMBEDDED_JOBS_PAGE_URL)
    if (!hasVerifiedEmbeddedJobsSignal(embeddedJobsHtml)) {
      throw new Error('Graviton verified embedded jobs page no longer matches the official first-party surface')
    }

    const jobs = extractIndiaJobsFromFirstPartyPayload(
      await fetchJson(buildFirstPartyJobsJsonUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createGravitonScraper(options).run(options)

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
