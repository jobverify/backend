import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOfficialAtsRecoveryScraper } from '../../scraper-support/utils/officialAtsRecovery.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const provider = {
  "source": "hoxhunt",
  "companyName": "Hoxhunt",
  "companyDomain": "hoxhunt.com",
  "companyCareerPage": "https://hoxhunt.com/careers",
  "officialHomepageUrl": "https://hoxhunt.com/",
  "sourceScopeComplete": false
}

export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const DISPOSITION = 'runtime-official-ats-recovery'
export const run = options => createOfficialAtsRecoveryScraper(provider).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
