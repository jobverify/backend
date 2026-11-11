import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remainingRecruitmentBatchProvider } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'
import {WEATHERFORD_CAREERS,WEATHERFORD_NATIVE_SITE,readWeatherfordPublisherDeclaration} from './currentPublisher20261110.js'

export const SOURCE = "weatherford"
export const COMPANY = "Weatherford"
export const CAREERS_URL = WEATHERFORD_CAREERS
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
export const run = options => createVerifiedRecruitmentScraper({
  ...remainingRecruitmentBatchProvider(SOURCE),companyCareerPage:WEATHERFORD_CAREERS,
  nativeOracleCandidateSite:WEATHERFORD_NATIVE_SITE,readCurrentPublisherDeclaration:readWeatherfordPublisherDeclaration,
}).run({preferIndiaInventory:true,...options})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
