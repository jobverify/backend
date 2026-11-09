import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_BASE_URL = 'https://jobs.festo.com'
export const INDIA_SEARCH_PATH = '/search/?q=&locationsearch=India'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[1] : null
}

export const buildIndiaSearchUrl = () => new URL(INDIA_SEARCH_PATH, CAREERS_BASE_URL).toString()

export const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const isIndiaLocation = (location) => /(?:,\s*IN\b|\bIndia\b)/i.test(location || '')

const extractJobId = (url) => extractFirst(/\/(\d+)\/?(?:[?#].*)?$/, url)

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<tr\b[^>]*class="[^"]*\bdata-row\b[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi,
)]
  .map((match) => {
    const row = match[1]
    const relativeUrl = extractFirst(
      /<a\b(?=[^>]*class="[^"]*\bjobTitle-link\b[^"]*")(?=[^>]*href="([^"]+)")[^>]*>/i,
      row,
    )
    const title = normalizeWhitespace(extractFirst(
      /<a\b[^>]*class="[^"]*\bjobTitle-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
      row,
    ))
    const location = normalizeWhitespace(extractFirst(
      /<span\b[^>]*class="[^"]*\bjobLocation\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      row,
    ))
    const department = normalizeWhitespace(extractFirst(
      /<span\b[^>]*class="[^"]*\bjobFunction\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      row,
    ))
    const sourceUrl = toAbsoluteUrl(relativeUrl)
    const jobId = extractJobId(sourceUrl)

    if (!title || !location || !isIndiaLocation(location) || !sourceUrl || !jobId) return null

    return {
      title,
      company: 'Festo',
      department,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createFestoScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(buildIndiaSearchUrl())

    return extractSearchResults(html).map((job) => ({
      ...job,
      source: 'festo',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createFestoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Festo scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'festo')
    console.log('DB result:', result)
    process.exit(0)
  }
}
