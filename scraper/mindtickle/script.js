import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SOURCE = 'mindtickle'
export const COMPANY = 'MindTickle'
export const ABOUT_URL = 'https://www.mindtickle.com/about-us/'
export const LEVER_BOARD_URL = 'https://jobs.lever.co/mindtickle'
export const LEVER_API_URL = 'https://api.lever.co/v0/postings/mindtickle?mode=json'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => String(value ?? '').replace(/<[^>]+>/g, ' ').trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hasVerifiedAboutPageSignal = (html) => {
  const source = String(html ?? '')
  const normalized = normalizeWhitespace(source)

  return /Mindtickle/i.test(source)
    && /Our people matter most/i.test(source)
    && /(dramatic impact on your career|See what opportunities are open at Mindtickle)/i.test(normalized)
    && /(View open opportunities|Join the team)/i.test(source)
    && /https:\/\/jobs\.lever\.co\/mindtickle/i.test(source)
}

export const normalizeLeverUrl = (value) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (url.hostname !== 'jobs.lever.co') return null
    if (!url.pathname.startsWith('/mindtickle/')) return null
    return url.toString()
  } catch {
    return null
  }
}

const isIndiaLocation = (value) => /\b(india|bengaluru|bangalore|pune)\b/i.test(
  normalizeWhitespace(value),
)

const isIndiaLeverPosting = (posting = {}) => {
  if (posting.country === 'IN') return true

  const location = posting?.categories?.location
  if (isIndiaLocation(location)) return true

  return Array.isArray(posting?.categories?.allLocations)
    && posting.categories.allLocations.some((item) => isIndiaLocation(item))
}

const getCity = (location) => {
  const normalized = normalizeWhitespace(location)
  return normalized ? normalized.split(',')[0].trim() : null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'on-site' || normalized === 'onsite') return 'On-site'
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : null
}

const buildJobDescription = (posting = {}) => {
  const parts = [
    stripHtml(posting.descriptionPlain || posting.description || ''),
    stripHtml(posting.openingPlain || posting.opening || ''),
    stripHtml(posting.additionalPlain || posting.additional || ''),
  ].filter(Boolean)

  return parts.join('\n\n') || null
}

export const extractIndiaJobsFromLeverPayload = (payload, { scrapedAt } = {}) => {
  const postings = Array.isArray(payload) ? payload : []
  const timestamp = scrapedAt || new Date().toISOString()

  return postings
    .filter((posting) => isIndiaLeverPosting(posting))
    .map((posting) => {
      const title = normalizeWhitespace(posting.text)
      const sourceUrl = normalizeLeverUrl(posting.hostedUrl)
      const applyUrl = normalizeLeverUrl(posting.applyUrl)

      if (!title) {
        throw new Error('MindTickle posting no longer exposes a trusted title')
      }

      if (!sourceUrl) {
        throw new Error('MindTickle posting no longer exposes a trusted Lever job url')
      }

      if (posting.applyUrl && !applyUrl) {
        throw new Error('MindTickle posting no longer exposes a trusted Lever apply url')
      }

      const location = normalizeWhitespace(posting?.categories?.location) || null

      return {
        title,
        company: COMPANY,
        location,
        city: getCity(location),
        country: 'India',
        link: sourceUrl,
        applyUrl: applyUrl || sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId: posting.id || sourceUrl,
        requisitionId: posting.id || sourceUrl,
        department: normalizeWhitespace(posting?.categories?.department) || null,
        employmentType: normalizeWhitespace(posting?.categories?.commitment) || null,
        experienceRequired: null,
        jobDescription: buildJobDescription(posting),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
        remoteStatus: normalizeRemoteStatus(posting.workplaceType),
        scrapedAt: timestamp,
      }
    })
}

export const createMindTickleScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const aboutHtml = await fetchText(ABOUT_URL)

    if (!hasVerifiedAboutPageSignal(aboutHtml)) {
      throw new Error(
        'MindTickle verified first-party about page no longer exposes the trusted Lever careers handoff',
      )
    }

    const jobs = extractIndiaJobsFromLeverPayload(
      await fetchJson(LEVER_API_URL, { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isInteger(maxJobs) && maxJobs > 0
      ? jobs.slice(0, maxJobs)
      : jobs
  },
})

export const run = async (options = {}) => createMindTickleScraper().run(options)

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
