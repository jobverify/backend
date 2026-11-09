import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'sendgrid'
export const COMPANY = 'SendGrid'
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

export const isExplicitSendGridRole = (value) => /\btwilio\s+sendgrid\b|\bsendgrid\b/i.test(clean(value))

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

export const createSendGridScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const searchUrl = new URL(SEARCH_URL)
    searchUrl.searchParams.set('domain', 'twilio.com')
    searchUrl.searchParams.set('query', 'SendGrid')
    searchUrl.searchParams.set('location', 'India')
    searchUrl.searchParams.set('start', '0')

    const listingPayload = await fetchJson(searchUrl.toString(), {
      method: 'GET',
      headers: REQUEST_HEADERS,
    })

    if (!Array.isArray(listingPayload?.data?.positions)) {
      throw new Error('[sendgrid] Twilio jobs contract no longer exposes data.positions')
    }

    const jobs = []
    const scrapedAt = now()

    for (const position of listingPayload.data.positions) {
      const jobId = position?.id
      const title = clean(position?.name)
      const location = clean(position?.locations?.[0])

      if (!jobId || !title || !isIndiaLocation(location)) {
        throw new Error('[sendgrid] Twilio jobs listing returned a malformed or foreign result')
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
        throw new Error(`[sendgrid] Twilio jobs detail is missing for ${jobId}`)
      }

      const jobDescription = detailPayload.data.jobDescription ?? null
      if (!isExplicitSendGridRole(`${title} ${jobDescription ?? ''}`)) {
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

export const run = (options = {}) => createSendGridScraper().run(options)
