import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://iprtechnologies.com/'
export const PAGES_API_URL = 'https://iprtechnologies.com/wp-json/wp/v2/pages?per_page=100'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const CAREER_SLUG_PATTERN = /\b(career|careers|job|jobs|opening|openings|join-us)\b/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: url === PAGES_API_URL
      ? 'application/json,text/plain;q=0.9,*/*;q=0.8'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'iprtechnologies',
  timeoutMs: 15000,
})

const parsePublishedPages = (payload) => {
  try {
    const parsed = JSON.parse(String(payload ?? ''))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const hasOfficialSiteSignal = (html) => /<title>\s*IPR Technologies Pvt Ltd\s*<\/title>/i.test(
  String(html ?? ''),
)

export const extractPublishedPageSlugs = (pages) => pages
  .map((page) => normalizeWhitespace(page?.slug)?.toLowerCase())
  .filter(Boolean)

export const hasPublicCareersPage = (pages) => extractPublishedPageSlugs(pages)
  .some((slug) => CAREER_SLUG_PATTERN.test(slug))

export const extractOpenings = () => []

export const createIPRTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialSiteSignal(homepageHtml)) {
      return []
    }

    const pagesPayload = await fetchText(PAGES_API_URL)
    const pages = parsePublishedPages(pagesPayload)

    if (hasPublicCareersPage(pages)) {
      throw new Error('IPR Technologies site now exposes a public careers page; scraper needs an update')
    }

    const jobs = extractOpenings(homepageHtml, pages)
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createIPRTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running IPR Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'iprtechnologies')
    console.log('DB result:', result)
    process.exit(0)
  }
}
