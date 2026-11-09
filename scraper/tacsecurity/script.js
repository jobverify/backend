import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const SOURCE = 'tacsecurity'
const COMPANY = 'TAC Security'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const INDIA_CITY_PATTERN =
  /\b(chandigarh|pune|mumbai|bangalore|bengaluru|hyderabad|chennai|gurgaon|gurugram|noida|delhi|kolkata|ahmedabad)\b/i

export const CAREERS_URL = 'https://tacsecurity.com/careers/'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|main|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const htmlToLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|main|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const buildJobDescription = (location) =>
  `Official TAC Security careers page opening listed at ${location}.`

const isIndiaLocation = (location) => /\bindia\b/i.test(normalizeWhitespace(location) || '')

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const match = normalized.match(INDIA_CITY_PATTERN)
  return match ? normalizeWhitespace(match[1]) : null
}

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Careers\s*\|\s*TAC Security\s*<\/title>/i.test(page)
    && /Open Positions/i.test(text)
    && /About TAC\.?/i.test(text)
    && /TAC Security is a global pioneer in risk and vulnerability management/i.test(text)
}

export const extractOpenPositions = (html) => {
  if (!hasOfficialCareersSurface(html)) {
    throw new Error('TAC Security careers page no longer matches the verified official public careers surface')
  }

  const lines = htmlToLines(html)
  const startIndex = lines.findIndex((line) => /^Open Positions$/i.test(line))
  const endIndex = lines.findIndex((line, index) => index > startIndex && /^About TAC\.?$/i.test(line))

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex + 1) {
    throw new Error('TAC Security careers page no longer exposes the verified open positions section')
  }

  const sectionLines = lines.slice(startIndex + 1, endIndex)
  const jobs = []

  for (let index = 0; index < sectionLines.length - 1; index += 2) {
    const title = normalizeWhitespace(sectionLines[index])
    const location = normalizeWhitespace(sectionLines[index + 1])

    if (!title || !location) continue
    if (!isIndiaLocation(location)) continue

    const slug = slugify(title)
    if (!slug) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId: `${SOURCE}-${slug}`,
      requisitionId: `${SOURCE}-${slug}`,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(location),
    })
  }

  if (jobs.length === 0) {
    throw new Error('TAC Security careers page no longer exposes verified India-linked public openings')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTacSecurityScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractOpenPositions(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createTacSecurityScraper().run(options)

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
