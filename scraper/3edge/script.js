import path from 'path'
import { fileURLToPath } from 'url'
import {PUBLIC_HOME_URL, THREE_EDGE_METADATA, run3EdgePublicRead} from './currentPublic.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = PUBLIC_HOME_URL
export const CAREERS_ROUTE_URL = 'https://3edge.com/careers'
export const JOBS_ROUTE_URL = 'https://3edge.com/jobs'

const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job opening|job openings|vacancy|vacancies|join us)\b/i
const MISSING_ROUTE_PATTERN = /\b404 not found\b/i

export const hasOfficialSiteSignal = (html) =>
  /3Edge Technologies: When it comes down to IT/i.test(html || '')

export const hasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(html || '')

export const isMissingCareerRoute = (html) => MISSING_ROUTE_PATTERN.test(html || '')

export const SCRAPER_METADATA = THREE_EDGE_METADATA

export const create3EdgeScraper = () => ({run: run3EdgePublicRead})

export const run = async (options = {}) => create3EdgeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running 3Edge scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, '3edge')
    console.log('DB result:', result)
    process.exit(0)
  }
}
