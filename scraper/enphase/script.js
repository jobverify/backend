import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'enphase'
export const COMPANY = 'Enphase'
export const OFFICIAL_BRAND_NAME = 'Enphase Energy'
export const VERIFIED_AT = '2026-07-26'
export const CAREERS_URL = 'https://enphase.com/en-in/node/9'
export const JOB_BOARD_URL = 'https://jobs.jobvite.com/enphase-energy/jobs'
export const DETAIL_URL_PATTERN = 'https://jobs.jobvite.com/enphase-energy/job/{jobvite_id}'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>(?=.)/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n+/g, '\n')
  .trim()

const firstMatch = (value, patterns) => {
  for (const pattern of patterns) {
    const match = String(value ?? '').match(pattern)
    const normalized = normalizeWhitespace(match?.[1])
    if (normalized) return normalized
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = JOB_BOARD_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => normalizeWhitespace(location).split(',')[0]?.trim() || null

const extractExperienceRequired = (value) => {
  const match = normalizeWhitespace(value).match(/\b\d+\s*(?:-\s*\d+|\+)?\s*years\b/i)
  return match ? match[0].replace(/\s+/g, ' ') : null
}

const extractRequiredSkills = (html) => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const createFetchTimeoutSignal = (timeoutMs = FETCH_TIMEOUT_MS) => {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createFetchTimeoutSignal(),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const hasOfficialJobBoardSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Open Positions/i.test(normalized)
    && /Enphase Energy Careers/i.test(normalized)
    && /Powered by Jobvite/i.test(normalized)
    && /href=["'][^"']*\/enphase-energy\/job\/[^"']+["']/i.test(page)
}

export const extractJobBoardListings = (html) => {
  const listings = []

  for (const tableMatch of String(html ?? '').matchAll(
    /<h3[^>]*class=["'][^"']*\bh2\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>\s*<table[^>]*class=["'][^"']*\bjv-job-list\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi,
  )) {
    const department = normalizeWhitespace(tableMatch[1])

    for (const rowMatch of tableMatch[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = rowMatch[1]
      const nameCell = rowHtml.match(/<td[^>]*class=["'][^"']*\bjv-job-list-name\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1]
      const locationCell = rowHtml.match(/<td[^>]*class=["'][^"']*\bjv-job-list-location\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1]
      const href = firstMatch(nameCell, [/<a[^>]*href=["']([^"']+)["']/i])
      const title = firstMatch(nameCell, [/<a[^>]*>([\s\S]*?)<\/a>/i])
      const location = normalizeWhitespace(locationCell).replace(/\s*,\s*/g, ', ')

      if (!href || !title || !/,\s*India$/i.test(location)) continue

      const detailUrl = toAbsoluteUrl(href)
      const jobId = detailUrl?.match(/\/job\/([^/?#]+)/i)?.[1] || null
      if (!detailUrl || !jobId) continue

      listings.push({
        title,
        department,
        location,
        city: extractCity(location),
        country: 'India',
        detailUrl,
        jobId,
        requisitionId: jobId,
      })
    }
  }

  return listings
}

const extractDescriptionSection = (html) => String(html ?? '')
  .match(/<h3[^>]*>\s*Description\s*<\/h3>([\s\S]*?)(?:<p[^>]*>\s*Powered by Jobvite\s*<\/p>|<\/body>)/i)?.[1] || ''

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractDescriptionSection(html)
  const detailUrl = listing.detailUrl || DETAIL_URL_PATTERN.replace('{jobvite_id}', listing.jobId)

  return {
    title: firstMatch(html, [/<h2[^>]*>([\s\S]*?)<\/h2>/i]) || listing.title || null,
    company: COMPANY,
    department: firstMatch(html, [/<p[^>]*class=["'][^"']*\bjob-meta\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i])?.replace(/\s+Bangalore, India$/i, '') || listing.department || null,
    location: listing.location || null,
    city: listing.city || null,
    country: listing.country || 'India',
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    sourceUrl: detailUrl,
    applyUrl: `${detailUrl}/apply`,
    employmentType: null,
    experienceRequired: extractExperienceRequired(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(descriptionHtml).replace(/\n+/g, ' '),
  }
}

export const createEnphaseScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const boardHtml = await fetchText(JOB_BOARD_URL)
    if (!hasOfficialJobBoardSignal(boardHtml)) {
      throw new Error('Enphase verified Jobvite board no longer matches the trusted public jobs surface')
    }

    const jobs = []
    for (const listing of extractJobBoardListings(boardHtml)) {
      const detailHtml = await fetchText(listing.detailUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        source: SOURCE,
        link: `${listing.detailUrl}/apply`,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createEnphaseScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
