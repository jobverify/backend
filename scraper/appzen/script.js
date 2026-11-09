import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'appzen'
export const COMPANY = 'AppZen'
export const VERIFIED_ON = '2026-08-01'
export const CAREERS_URL = 'https://www.appzen.com/careers'
export const LEVER_ACCOUNT = 'appzen'
export const LEVER_BOARD_URL = `https://jobs.lever.co/${LEVER_ACCOUNT}`
export const LEVER_API_URL = `https://api.lever.co/v0/postings/${LEVER_ACCOUNT}?mode=json`
export const DISPOSITION = 'verified-first-party-careers-page-plus-public-lever-jobs-api'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://www.appzen.com/careers remained the live exact-name AppZen careers surface, that it still embedded the public Lever account appzen, and that the corresponding public Lever board at https://jobs.lever.co/appzen plus https://api.lever.co/v0/postings/appzen?mode=json exposed a trustworthy public jobs inventory including India roles. The public Lever board footer now renders Powered by Lever instead of the older Jobs powered by Lever copy, while preserving the same public jobs contract. This scraper validates the verified first-party careers embed and public Lever board, then returns India jobs only from the public Lever API.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const normalizeLeverUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    const account = url.pathname.split('/').filter(Boolean)[0]

    if (url.protocol !== 'https:') return null
    if (url.hostname !== 'jobs.lever.co') return null
    if (account !== LEVER_ACCOUNT) return null

    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^remote\b/i.test(normalized) || /^india$/i.test(normalized)) return null

  return normalized.split(/\s*[,/]\s*/)[0] || null
}

const buildLocation = (job = {}) => {
  const location = normalizeWhitespace(job?.categories?.location)
  if (location) return location

  const allLocations = Array.isArray(job?.categories?.allLocations)
    ? job.categories.allLocations.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : []

  return allLocations.join(' / ') || null
}

const buildJobDescription = (job = {}) => {
  const parts = [
    job?.descriptionBodyPlain,
    job?.descriptionPlain,
    job?.openingPlain,
    job?.additionalPlain,
    job?.descriptionBody,
    job?.description,
    job?.opening,
    job?.additional,
  ]
    .map((part) => normalizeText(part))
    .filter(Boolean)

  return parts[0] || null
}

const isIndiaJob = (job = {}) => {
  const country = normalizeWhitespace(job?.country)?.toUpperCase()
  if (country === 'IN' || country === 'IND') return true

  const locations = [
    job?.categories?.location,
    ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
  ]
    .map((location) => normalizeWhitespace(location))
    .filter(Boolean)

  return locations.some((location) => /\bindia\b/i.test(location))
}

export const extractLeverAccountName = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(
      /leverJobsOptions\s*=\s*\{[\s\S]*?accountName\s*:\s*['"]([^'"]+)['"][\s\S]*?\}/i,
    )?.[1],
  )

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeText(rawHtml)

  return /<title[^>]*>\s*Search Jobs and Apply Here\s*\|\s*AppZen Careers\s*<\/title>/i.test(
    rawHtml,
  )
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.appzen\.com\/careers["']/i.test(
      rawHtml,
    )
    && /\bCareers at AppZen\b/i.test(text)
    && /\bShape the future of finance AI\b/i.test(text)
    && /\bCurrent Openings\b/i.test(text)
    && /id=["']lever-jump["']/i.test(rawHtml)
    && /id=["']lever-jobs-container["']/i.test(rawHtml)
    && /andreasmb\.github\.io\/lever-jobs-embed\/index\.js/i.test(rawHtml)
}

export const hasOfficialLeverBoardSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeText(rawHtml)
  const hasLeverFooterBranding =
    /\b(?:Jobs\s+)?Powered by\b/i.test(text)
    && /alt=["']Lever logo["']|lever-logo-/i.test(rawHtml)
  const hasVisibleBoardContent =
    /Job openings at AppZen,\s*Inc\.?/i.test(text)
    || (
      /\bLocation type\b/i.test(text)
      && /\bLocation\b/i.test(text)
      && /\bTeam\b/i.test(text)
      && /\bWork type\b/i.test(text)
      && /https:\/\/jobs\.lever\.co\/appzen\/[a-z0-9-]+/i.test(rawHtml)
    )

  return /<title[^>]*>\s*AppZen,\s*Inc\.\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/jobs\.lever\.co\/appzen["']/i.test(
      rawHtml,
    )
    && hasVisibleBoardContent
    && /https:\/\/www\.appzen\.com\//i.test(rawHtml)
    && hasLeverFooterBranding
}

export const extractIndiaLeverJobs = (payload = []) => {
  if (!Array.isArray(payload)) {
    throw new Error('AppZen Lever postings payload no longer returns an array')
  }

  return payload
    .filter((job) => isIndiaJob(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const jobId = normalizeWhitespace(job?.id)
      const location = buildLocation(job)
      const sourceUrl = normalizeLeverUrl(job?.hostedUrl)
      const applyUrl = normalizeLeverUrl(job?.applyUrl) || sourceUrl

      if (!title || !jobId || !location || !sourceUrl || !applyUrl) {
        throw new Error(
          'AppZen Lever postings payload no longer exposes the verified India job fields',
        )
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription: buildJobDescription(job),
        remoteStatus: toRemoteStatus(job?.workplaceType),
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createAppZenScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (
      !hasOfficialCareersPageSignal(careersHtml)
      || extractLeverAccountName(careersHtml) !== LEVER_ACCOUNT
    ) {
      throw new Error('AppZen verified official careers page changed materially')
    }

    const leverBoardHtml = await fetchText(LEVER_BOARD_URL)
    if (!hasOfficialLeverBoardSignal(leverBoardHtml)) {
      throw new Error('AppZen verified public Lever board changed materially')
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

export const run = async (options = {}) => createAppZenScraper().run(options)
