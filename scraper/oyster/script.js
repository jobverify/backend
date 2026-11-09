import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDeclaredAshbyScraper } from '../../scraper-support/native-sources/declaredAshby/nativeCareers.js'
export const NATIVE_CONTRACT = {
  "source": "oyster",
  "companyName": "Oyster",
  "boardSlug": "oyster",
  "organizationId": "8807c794-83d9-4713-8b58-dc61a70ee77e",
  "websiteOrigin": "https://www.oysterhr.com",
  "primaryURL": "https://www.oysterhr.com/careers",
  "boardURL": "https://jobs.ashbyhq.com/oyster",
  "apiURL": "https://api.ashbyhq.com/posting-api/job-board/oyster",
  "embeddingScript": "https://jobs.ashbyhq.com/oyster/embed"
}
export const SOURCE = NATIVE_CONTRACT.source
export const COMPANY = NATIVE_CONTRACT.companyName
export const CAREERS_URL = NATIVE_CONTRACT.primaryURL
export const PROVIDER_METADATA = { source: SOURCE, companyName: COMPANY, atsPlatform: 'ashby',
  boardToken: NATIVE_CONTRACT.boardSlug, companyCareerPage: CAREERS_URL }
export const run = options => createDeclaredAshbyScraper(NATIVE_CONTRACT).run(options)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
