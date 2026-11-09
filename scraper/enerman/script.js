import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://enerman.in/'
export const CONTACT_URL = 'https://enerman.in/contact/'

const SOURCE = 'enerman'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /EnerMAN Technologies/i.test(page)
    && /EnerMAN Technologies Pvt\.? Ltd\.?/i.test(page)
    && /Products/i.test(page)
    && /Contact/i.test(page)
    && !/Careers|Jobs/i.test(page)
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  return /Let[’']?s Connect for Smarter Energy Solutions/i.test(page)
    && /renewable energy project/i.test(page)
    && !/job opening|current openings|open positions|vacanc/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEnerManScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('EnerMAN homepage no longer matches the verified official public site')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('EnerMAN contact page no longer matches the verified official no-public-listings surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEnerManScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EnerMAN scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
