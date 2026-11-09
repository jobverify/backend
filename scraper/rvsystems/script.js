import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://rvsystems.co.in/'

const OFFICIAL_SITE_SIGNAL_PATTERN = /RV Systems Private Limited|rvsystems\.co\.in/i
const CONTACT_SIGNAL_PATTERN = /contact@rvsystems\.co\.in|Book a Demo|customer support/i
const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job opening|job openings|join us|apply now)\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'rvsystems',
  timeoutMs: 15000,
})

export const hasOfficialSiteSignal = (html) => OFFICIAL_SITE_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasContactSignal = (html) => CONTACT_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(String(html ?? ''))

export const extractOpenings = () => []

export const createRVSystemsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialSiteSignal(html) || !hasContactSignal(html)) {
      return []
    }

    if (hasCareersSignal(html)) {
      throw new Error('RV Systems site now exposes public career signals; scraper needs an update')
    }

    const jobs = extractOpenings(html)
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createRVSystemsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running RV Systems scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'rvsystems')
    console.log('DB result:', result)
    process.exit(0)
  }
}
