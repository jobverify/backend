import path from 'node:path'
import { fileURLToPath } from 'node:url'
import provider from './provider.js'
import { specCards, specOfficial } from '../../scraper-support/native-sources/citiSpec/nativeCareers.js'
import {createNativeSpecScraper} from './nativeRun.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const hasOfficialCareersSignal = specOfficial
export const extractCurrentOpenings = specCards
export const createSpecIndiaScraper = options => createNativeSpecScraper(options)
export const run = options => createSpecIndiaScraper().run(options)

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
