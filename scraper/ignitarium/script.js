import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ignitarium'
export const COMPANY = 'Ignitarium'
export const CAREERS_URL = 'https://ignitarium.com/careers/'
export const NEUREALM_BASE_URL = 'https://www.neurealm.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/a|\/time)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|main|h[1-6]|a|time)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n+/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join(' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), NEUREALM_BASE_URL).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const parsePostingDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  const monthValue = MONTHS[month.toLowerCase()]
  if (!monthValue) return null

  return `${year}-${monthValue}-${day.padStart(2, '0')}`
}

const deriveCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const [primary] = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return normalizeCity(primary || normalized)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /Job openings/i.test(text)
    && /Explore opportunities within the walls of Neurealm/i.test(text)
    && /Protect Yourself from Job Scams/i.test(text)
    && /View Job/i.test(text)
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Ignitarium careers page no longer matches the verified official public careers surface')
  }

  const page = String(html ?? '')
  const jobs = [...page.matchAll(
    /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})[\s\S]{0,250}?<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>[\s\S]{0,250}?>\s*([0-9]+(?:\s*-\s*[0-9]+)?\s*Years|-+\s*Years)\s*<[\s\S]{0,250}?>\s*([A-Za-z][A-Za-z .-]+?)\s*<[\s\S]{0,250}?<a[^>]+href=(?:"([^"]+)"|'([^']+)')[^>]*>\s*View Job\s*<\/a>/gi,
  )]
    .map((match) => {
      const rawDate = normalizeWhitespace(match[1])
      const title = normalizeWhitespace(match[2])
      const experienceRequired = normalizeWhitespace(match[3])
      const rawLocation = normalizeWhitespace(match[4])
      const sourceUrl = toAbsoluteUrl(match[5] || match[6])

      if (!rawDate || !title || !experienceRequired || !rawLocation || !sourceUrl) return null

      const location = normalizeLocation(rawLocation)

      return {
        title,
        location,
        city: deriveCity(location),
        experienceRequired,
        postingDate: parsePostingDate(rawDate),
        sourceUrl,
        applyUrl: sourceUrl,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Ignitarium careers page no longer exposes verified Neurealm public job cards')
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

export const createIgnitariumScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractJobCards(html).map((job) => {
      const identitySlug = slugify(`${job.title}-${job.location}-${job.postingDate || 'open'}`)

      return {
        ...job,
        company: COMPANY,
        department: null,
        country: 'India',
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        employmentType: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        closingDate: null,
        jobDescription: null,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }
    })
  },
})

export const run = async (options = {}) => createIgnitariumScraper().run(options)

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
