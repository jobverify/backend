import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CYBER_INFRASTRUCTURE_CATALOG } from './catalog.js'
import { createPublishedCareersScraper, officialPrimary, roleLinks } from '../../scraper-support/native-sources/cisVeeam/nativeCareers.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = CYBER_INFRASTRUCTURE_CATALOG
export const SOURCE = 'cyberinfrastructure'
export const COMPANY = 'Cyber Infrastructure'
export const CAREERS_URL = 'https://career.cisin.com/'
export const VERIFIED_ON = null
export const hasOfficialJobsBoardSignal = html => officialPrimary(SOURCE, html)
// Discovery links only; country qualification belongs to each own role.
export const parseIndiaJobs = html => roleLinks(SOURCE, html)
export const createCyberInfrastructureScraper = () => createPublishedCareersScraper(SOURCE)
export const run = options => createCyberInfrastructureScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
