import path from 'path'
import { fileURLToPath } from 'url'

import {
  CAREER_PAGE_ID,
  CAREER_PAGE_URL,
  FILTERED_JOBS_URL,
  NOAUTH_TOKEN_URL,
  createTurbohireScraper,
  extractSearchResults,
} from './shared.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export {
  CAREER_PAGE_ID,
  CAREER_PAGE_URL,
  FILTERED_JOBS_URL,
  NOAUTH_TOKEN_URL,
  extractSearchResults,
}

export const createOlaScraper = () => createTurbohireScraper({
  companyName: 'Ola',
  source: 'ola',
})

export const run = async (options = {}) => createOlaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Ola scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'ola')
    console.log('DB result:', result)
    process.exit(0)
  }
}
