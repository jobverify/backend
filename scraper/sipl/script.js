import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.sipl-sustainability.com/'
export const CONTACT_PAGE_URL = 'https://www.sipl-sustainability.com/contact.html'

const OFFICIAL_SITE_SIGNAL_PATTERN = /<title>\s*SIPL\s*-\s*SIPL Pvt Ltd\s*<\/title>|SIPL Pvt Ltd/i
const CONTACT_SIGNAL_PATTERN = /support@siplsustainability\.onmicrosoft\.com|\+91\s*9911921666|Contact Us - SIPL Pvt Ltd/i
const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job opening|job openings|vacancy|vacancies)\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'sipl',
  timeoutMs: 15000,
})

export const hasOfficialSiteSignal = (html) => OFFICIAL_SITE_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasContactSignal = (html) => CONTACT_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(String(html ?? ''))

export const extractOpenings = () => []

export const createSIPLScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialSiteSignal(homepageHtml)) {
      return []
    }

    const contactHtml = await fetchText(CONTACT_PAGE_URL)

    if (!hasContactSignal(contactHtml)) {
      return []
    }

    if (hasCareersSignal(homepageHtml) || hasCareersSignal(contactHtml)) {
      throw new Error('SIPL site now exposes public career signals; scraper needs an update')
    }

    const jobs = extractOpenings(homepageHtml, contactHtml)
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createSIPLScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running SIPL scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'sipl')
    console.log('DB result:', result)
    process.exit(0)
  }
}
