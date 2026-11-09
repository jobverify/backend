import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://edoofa.com/'
export const WORK_WITH_URL = 'https://edoofa.com/work-with-edoofa/'

const OFFICIAL_SITE_SIGNAL_PATTERN = /<title>\s*Edoofa\b[\s\S]*?Education for all|Edoofa is a platform for students to pursue Affordable Higher Education in India/i
const CONTACT_SIGNAL_PATTERN = /studentcare@edoofa\.com|\+91\s*72920\s*66328|Gurugram,\s*Haryana,\s*India/i
const WORK_WITH_FORM_SIGNAL_PATTERNS = [
  /<title>\s*Work With Edoofa\b/i,
  /<form\b[^>]*name=["']Work With Edoofa["']/i,
  /Full name/i,
  /WhatsApp Number/i,
  /Upload CV\/Resume/i,
  /Submit your Application/i,
]
const PUBLIC_JOBS_SIGNAL_PATTERN = /\b(current openings|job openings|open positions|vacancies|we are hiring|hiring now)\b|class=["'][^"']*job-card[^"']*["']/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'edoofa',
  timeoutMs: 15000,
})

export const hasOfficialSiteSignal = (html) => OFFICIAL_SITE_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasContactSignal = (html) => CONTACT_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasWorkWithFormSignal = (html) => WORK_WITH_FORM_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasPublicJobsSignal = (html) => PUBLIC_JOBS_SIGNAL_PATTERN.test(String(html ?? ''))

export const extractOpenings = () => []

export const createEdoofaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialSiteSignal(homepageHtml) || !hasContactSignal(homepageHtml)) {
      return []
    }

    const workWithHtml = await fetchText(WORK_WITH_URL)

    if (hasPublicJobsSignal(workWithHtml)) {
      throw new Error('Edoofa site now exposes public job listings; scraper needs an update')
    }

    if (!hasWorkWithFormSignal(workWithHtml)) {
      return []
    }

    const jobs = extractOpenings(workWithHtml)
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createEdoofaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Edoofa scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'edoofa')
    console.log('DB result:', result)
    process.exit(0)
  }
}
