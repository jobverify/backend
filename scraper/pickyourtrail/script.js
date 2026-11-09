import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pickyourtrail'
export const COMPANY = 'Pickyourtrail'
export const CAREERS_URL = 'https://pickyourtrail.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
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

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const isExperienceChip = (value) => /\b(?:yrs?|years?)\b/i.test(String(value ?? ''))

export const extractApplyEmail = (html) =>
  String(html ?? '').match(/href=["'](mailto:careers@pickyourtrail\.com)["']/i)?.[1] || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return normalized.includes('careers at pickyourtrail: join our travel team')
    && normalized.includes('read more')
    && normalized.includes('engineering')
    && normalized.includes('internship programme @ pickyourtrail')
    && /current opening roles and apply/i.test(page)
    && extractApplyEmail(html) === 'mailto:careers@pickyourtrail.com'
}

const extractCardBlocks = (html) => {
  return [...String(html ?? '').matchAll(
    /<div class="[^"]*iiKNzEw-css[^"]*">([\s\S]*?)<button[^>]*>\s*<span[^>]*>\s*Read more\s*<\/span>\s*<\/button>\s*<\/div>\s*<\/div>/gi,
  )].map((match) => match[1])
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) return []

  const applyUrl = extractApplyEmail(html)
  const listings = []
  const seen = new Set()

  for (const block of extractCardBlocks(html)) {
    const spans = [...block.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)
      .filter((value) => value !== 'Read more')

    if (spans.length < 3) continue

    const [title, department, ...chips] = spans
    const jobId = slugify(title)
    const experienceRequired = chips.find((value) => isExperienceChip(value)) || null
    const location = [...chips].reverse().find((value) => !isExperienceChip(value)) || null

    if (!title || !department || !location || !jobId || seen.has(jobId)) continue

    seen.add(jobId)
    listings.push({
      title,
      company: COMPANY,
      department,
      location,
      city: normalizeCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      experienceRequired,
      sourceUrl: CAREERS_URL,
      applyUrl: applyUrl || CAREERS_URL,
    })
  }

  return listings
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPickyourtrailScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('verified Pickyourtrail careers surface no longer matches the official public page')
    }

    const listings = extractListings(careersHtml)
    if (listings.length === 0) {
      throw new Error('verified Pickyourtrail careers surface no longer exposes public role cards')
    }

    return listings.map((job) => ({
      ...job,
      employmentType: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPickyourtrailScraper().run(options)

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
