import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { runSearch } from './searchApi.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const runHashiCorpSearch = async (options = {}) => runSearch({
  source: 'hashicorp',
  companyName: 'HashiCorp',
  query: 'hashicorp',
  pageSize: Number.isInteger(config.pageSize) ? config.pageSize : 100,
  maxJobs: Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages: Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  ...options,
})

export const run = async () => runHashiCorpSearch()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running HashiCorp scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'hashicorp')
    console.log('DB result:', result)
    process.exit(0)
  }
}
