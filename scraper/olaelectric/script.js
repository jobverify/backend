import path from 'path'
import { fileURLToPath } from 'url'

import { createTurbohireScraper } from '../ola/shared.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const createOlaElectricScraper = () => createTurbohireScraper({
  companyName: 'Ola Electric',
  source: 'olaelectric',
})

export const run = async (options = {}) => createOlaElectricScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Ola Electric scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'olaelectric')
    console.log('DB result:', result)
    process.exit(0)
  }
}
