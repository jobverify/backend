import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'

export const PROVIDER_METADATA = {
  "source": "bitwarden",
  "companyName": "Bitwarden",
  "atsPlatform": "greenhouse",
  "boardToken": "bitwarden",
  "companyCareerPage": "https://bitwarden.com/careers/7932121003/?gh_jid=7932121003"
}
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const run = (options = {}) => createPublishingGapAtsScraper(PROVIDER_METADATA).run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
