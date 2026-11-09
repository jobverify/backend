import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'gate'
export const COMPANY = 'Gate'
export const OFFICIAL_CAREERS_URL = 'https://www.gate.com/careers'
export const LEVER_BOARD_URL = 'https://jobs.lever.co/gate'
export const LEVER_ENDPOINT = 'https://api.lever.co/v0/postings/gate?mode=json'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_CAREERS_SIGNALS = [
  'gate careers | crypto & web3 jobs at gate | gate.com',
  'join gate & shape a new career chapter',
  'join global innovators to shape the future of crypto finance and create your own impact.',
  'our culture, one gate',
  'our core values',
  'why gate',
  'unlock your next career chapter',
  'view all positions',
  'gate news & insights',
  'linkedin',
]

const LEVER_BOARD_SIGNALS = [
  'location type',
  'work type',
  'location all',
  'team all',
  'Gate Home Page',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/[\u2012-\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const isLocationCode = (value) => /^[A-Za-z]+(?:-[A-Z0-9]+)+$/.test(value)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || isLocationCode(normalized)) return null
  return normalized.split(/\s+-\s+|,/)[0] || null
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

const toCountryName = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^[A-Z]{2}$/.test(normalized)) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized) || normalized
    } catch {
      return normalized
    }
  }

  return normalized
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(parts.filter(Boolean).join(' '))

const extractJobDescription = (job) => joinDescriptionParts(
  normalizeWhitespace(job?.descriptionPlain),
  stripTags(job?.description),
  normalizeWhitespace(job?.additionalPlain),
  stripTags(job?.additional),
  normalizeWhitespace(job?.openingPlain),
  stripTags(job?.opening),
)

const requireField = (value, fieldName) => {
  if (!value) {
    throw new Error(`Gate Lever jobs payload changed: missing ${fieldName}`)
  }

  return value
}

export const hasOfficialCareersSignal = (html) => {
  const text = stripTags(html)?.toLowerCase() || ''

  return OFFICIAL_CAREERS_SIGNALS.every((signal) => text.includes(signal))
}

export const hasLeverBoardSignal = (html) => {
  const markup = String(html ?? '')
  const text = stripTags(html)?.toLowerCase() || ''

  return /<title>\s*Gate\s*<\/title>/i.test(markup)
    && LEVER_BOARD_SIGNALS.every((signal) => text.includes(signal.toLowerCase()))
}

export const extractLeverJobs = (leverJobs = []) => (Array.isArray(leverJobs) ? leverJobs : [])
  .map((job) => {
    const id = requireField(normalizeWhitespace(job?.id), 'job id')
    const title = requireField(normalizeWhitespace(job?.text), `title for ${id}`)
    const location = requireField(
      normalizeWhitespace(job?.categories?.location || job?.categories?.allLocations?.[0]),
      `location for ${id}`,
    )
    const sourceUrl = requireField(normalizeWhitespace(job?.hostedUrl), `hosted URL for ${id}`)

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
      location,
      city: extractCity(location),
      country: toCountryName(job?.country),
      jobId: id,
      requisitionId: id,
      sourceUrl,
      applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
      employmentType: normalizeWhitespace(job?.categories?.commitment),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDateTime(job?.createdAt),
      closingDate: null,
      jobDescription: extractJobDescription(job),
      remoteStatus: toRemoteStatus(job?.workplaceType),
    }
  })

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, label: SOURCE, timeoutMs: 15000,
})
const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, label: SOURCE, timeoutMs: 15000,
})
export const CAREER_API_BASE = 'https://www.gate.com/api/web/v1/tst/career'
const buildApiUrl = (route, params) => {
  const url = new URL(CAREER_API_BASE + '/' + route)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}
const requirePosition = (row) => {
  if (!Number.isInteger(row?.position_id) || row.position_id <= 0
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row?.slug || '')
    || !normalizeWhitespace(row?.public_title) || !normalizeWhitespace(row?.location)
    || !normalizeWhitespace(row?.job_category_code) || !normalizeWhitespace(row?.employment_type_code)
    || !['remote', 'hybrid', 'onsite', 'on-site'].includes(row?.work_mode)) {
    throw new Error('Gate first-party positions payload contains an incomplete record')
  }
}
export const createGateScraper = ({
  now: defaultNow = () => new Date().toISOString(), pageSize = 50, maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = defaultNow, signal } = {}) {
    const request = async (fetcher, url) => {
      signal?.throwIfAborted()
      const result = await fetcher(url, { signal })
      signal?.throwIfAborted()
      return result
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50
      || maxJobs != null && (!Number.isInteger(maxJobs) || maxJobs < 1)) throw new Error('Gate listing limits must be positive integers, pageSize at most 50')
    const html = await request(fetchText, OFFICIAL_CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) throw new Error('Gate official Gate careers surface no longer matches the verified first-party careers page')
    const taxonomies = await request(fetchJson, buildApiUrl('taxonomies', { site_code: 'global', lang: 'en' }))
    if (taxonomies?.code !== 0 || !Array.isArray(taxonomies?.data?.job_categories)
      || !Array.isArray(taxonomies?.data?.employment_types)
      || [...taxonomies.data.job_categories, ...taxonomies.data.employment_types].some(row => !normalizeWhitespace(row?.code) || !normalizeWhitespace(row?.label))) {
      throw new Error('Gate first-party career taxonomies payload changed')
    }
    const categories = new Map(taxonomies.data.job_categories.map(row => [row.code, row.label]))
    const employmentTypes = new Map(taxonomies.data.employment_types.map(row => [row.code, row.label]))
    const positions = new Map()
    let total = null
    for (let page = 1; ; page += 1) {
      const payload = await request(fetchJson, buildApiUrl('positions', { site_code: 'global', page, limit: pageSize }))
      const data = payload?.data
      if (payload?.code !== 0 || !Number.isInteger(data?.total) || data.total < 0
        || data.page !== page || data.limit !== pageSize || !Array.isArray(data.list)
        || (total != null && data.total !== total)
        || data.list.length !== Math.min(pageSize, Math.max(0, data.total - (page - 1) * pageSize))) {
        throw new Error('Gate first-party positions payload is failed, malformed or incomplete')
      }
      total = data.total
      for (const row of data.list) {
        requirePosition(row)
        if (positions.has(row.position_id)) throw new Error('Gate first-party positions inventory repeats a job ID')
        positions.set(row.position_id, row)
      }
      if (page * pageSize >= total) break
    }
    if (positions.size !== total) throw new Error('Gate first-party positions inventory is incomplete')
    const selected = [...positions.values()].slice(0, maxJobs || Infinity)
    const jobs = []
    for (const row of selected) {
      const detail = await request(fetchJson, buildApiUrl('position_detail', { position_id: row.position_id, site_code: 'global' }))
      const data = detail?.data
      if (detail?.code !== 0 || data?.position_id !== row.position_id || data?.slug !== row.slug
        || data?.public_title !== row.public_title || data?.location !== row.location) throw new Error('Gate first-party job detail identity changed')
      const description = joinDescriptionParts(stripTags(data.about_role), stripTags(data.responsibilities), stripTags(data.requirements))
      if (!description || !categories.has(row.job_category_code) || !employmentTypes.has(row.employment_type_code)) throw new Error('Gate first-party job detail is incomplete')
      const sourceUrl = 'https://www.gate.com/careers/jobs/' + row.slug
      jobs.push({
        title: normalizeWhitespace(row.public_title), company: COMPANY, department: categories.get(row.job_category_code),
        location: normalizeWhitespace(row.location), city: /^remote$/i.test(row.location) ? null : extractCity(row.location), country: null,
        jobId: String(row.position_id), requisitionId: String(row.position_id), sourceUrl, applyUrl: sourceUrl,
        employmentType: employmentTypes.get(row.employment_type_code), experienceRequired: null, minimumQualification: null,
        preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null, jobDescription: description,
        remoteStatus: toRemoteStatus(row.work_mode), source: SOURCE, link: sourceUrl, scrapedAt: now(),
        companyCareerPage: OFFICIAL_CAREERS_URL, companyDomain: 'gate.com', atsPlatform: 'official-first-party-careers-api',
        ...(selected.length < positions.size ? { sourceListingComplete: false } : {}),
      })
    }
    return jobs
  },
})
export const run = async (options = {}) => createGateScraper(options).run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
