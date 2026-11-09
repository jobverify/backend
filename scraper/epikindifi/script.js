import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://epikindifi.com/'
export const CAREERS_URL = 'https://epikindifi.com/careers/'

const SOURCE = 'epikindifi'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Home\s*-\s*Epikindifi\s*-\s*Digital Lending Platform Ecosystem\s*<\/title>/i.test(page)
    && /Digital Lending Made Simple/i.test(page)
    && /Apply Now/i.test(page)
}

export const hasEmptyCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && /Recent Posts/i.test(page)
    && /Hello world!/i.test(page)
    && /Apply Now/i.test(page)
    && !/job opening|current openings|apply now for|view openings|job description/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEpikindifiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('EPIKInDiFi homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasEmptyCareersSignal(careersHtml)) {
      throw new Error('EPIKInDiFi careers page no longer matches the verified empty public stub')
    }

    return []
  },
})

export const run = async (options = {}) => createEpikindifiScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EPIKInDiFi scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
