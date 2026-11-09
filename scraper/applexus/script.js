import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createCurrentApplexusScraper, readApplexusListing } from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.applexus.com/careers'

export const buildSearchUrl = () => CAREER_PAGE_URL

// The HTML shell has no native roles; the live source enumerates its declared
// public client inventory instead of interpreting that shell as an empty board.
export const extractSearchResults = payload => typeof payload === 'string' || payload == null ? [] : readApplexusListing(payload).rows

export const createApplexusScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  ...defaults
} = {}) => createCurrentApplexusScraper({ ...defaults, maxJobs })

export const run = async (options = {}) => createApplexusScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Applexus scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'applexus')
    console.log('DB result:', result)
    process.exit(0)
  }
}
