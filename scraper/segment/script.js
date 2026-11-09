import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)

export const SOURCE = 'segment'
export const COMPANY = 'Segment'
export const OFFICIAL_BRAND_NAME = 'Twilio Segment'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_URL = 'https://jobs.twilio.com/careers'
export const SEARCH_URL = 'https://jobs.twilio.com/api/pcsx/search'
export const DETAIL_URL = 'https://jobs.twilio.com/api/pcsx/position_details'

const REQUEST_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: CAREERS_URL,
  Origin: 'https://jobs.twilio.com',
}

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const deriveCity = (location) => {
  const normalized = clean(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'
  return normalized.split(/[,-]/)[0]?.trim() || null
}

const isIndiaLocation = (location) => /\bindia\b/i.test(clean(location))

export const isExplicitSegmentRole = (value) =>
  /\btwilio\s+segment\b|\bsegment\s+team\b|\bsegment\s+data\s+platform\b/i.test(clean(value))

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: { ...REQUEST_HEADERS, ...(options.headers || {}) },
  label: SOURCE,
  timeoutMs: 20000,
})

const firstPostingDate = (value) => Array.isArray(value) ? clean(value[0]) || null : clean(value) || null

const canonicalJobUrl = (value, jobId) => {
  const fallback = `https://jobs.twilio.com/careers/job/${encodeURIComponent(jobId)}`
  if (!value) return fallback

  try {
    const url = new URL(value, CAREERS_URL)
    return `${url.origin}${url.pathname}`
  } catch {
    return fallback
  }
}

export const createSegmentScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const searchUrl = new URL(SEARCH_URL)
    searchUrl.searchParams.set('domain', 'twilio.com')
    searchUrl.searchParams.set('query', 'Segment')
    searchUrl.searchParams.set('location', 'India')
    searchUrl.searchParams.set('start', '0')

    const listingPayload = await fetchJson(searchUrl.toString(), {
      method: 'GET',
      headers: REQUEST_HEADERS,
    })

    if (!Array.isArray(listingPayload?.data?.positions)) {
      throw new Error('[segment] Twilio jobs contract no longer exposes data.positions')
    }

    const jobs = []
    const scrapedAt = now()

    for (const position of listingPayload.data.positions) {
      const jobId = position?.id
      const title = clean(position?.name)
      const location = clean(position?.locations?.[0])

      if (!jobId || !title || !isIndiaLocation(location)) {
        throw new Error('[segment] Twilio jobs listing returned a malformed or foreign result')
      }

      const detailUrl = new URL(DETAIL_URL)
      detailUrl.searchParams.set('position_id', String(jobId))
      detailUrl.searchParams.set('domain', 'twilio.com')
      detailUrl.searchParams.set('hl', 'en')

      const detailPayload = await fetchJson(detailUrl.toString(), {
        method: 'GET',
        headers: REQUEST_HEADERS,
      })

      if (!detailPayload?.data || typeof detailPayload.data !== 'object') {
        throw new Error(`[segment] Twilio jobs detail is missing for ${jobId}`)
      }

      const jobDescription = detailPayload.data.jobDescription ?? null
      if (!isExplicitSegmentRole(`${title} ${jobDescription ?? ''}`)) {
        continue
      }

      const sourceUrl = canonicalJobUrl(detailPayload.data.publicUrl, jobId)
      jobs.push({
        title,
        company: COMPANY,
        location,
        city: deriveCity(location),
        country: 'India',
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId,
        requisitionId: clean(position?.displayJobId) || String(jobId),
        department: clean(position?.department) || null,
        employmentType: null,
        experienceRequired: null,
        postingDate: firstPostingDate(detailPayload.data.efcustomTextPostDate),
        jobDescription,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = (options = {}) => createSegmentScraper().run(options)

const isDirectRun = () => {
  if (!process.argv[1]) return false
  return path.resolve(process.argv[1]) === currentFilePath
}

if (isDirectRun()) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
