import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://www.asaco.in/'
export const CAREERS_PAGE_URL = 'https://www.asaco.in/careers/'
export const CAREER_PAGE_URL = 'https://www.asaco.in/career/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialSiteSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  return normalized.includes('asaco india') && normalized.includes('pioneer in manufacturing aerospace components')
}

export const hasMissingCareersRouteSignal = ({ status, html }) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  return status === 404 && normalized.includes("we couldn't find the page you were looking for")
}

export const extractOpenings = () => []

export const createAsacoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!hasOfficialSiteSignal(homepage.html)) {
      return []
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    const careerPage = await fetchPage(CAREER_PAGE_URL)

    if (
      !hasMissingCareersRouteSignal(careersPage)
      || !hasMissingCareersRouteSignal(careerPage)
    ) {
      throw new Error('ASACO site now exposes a public careers route; scraper needs an update')
    }

    const jobs = extractOpenings()
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createAsacoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ASACO scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'asaco')
    console.log('DB result:', result)
    process.exit(0)
  }
}
