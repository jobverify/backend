import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recruitmentBatchProviders } from '../../scraper-support/utils/recruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'

export const SOURCE = "bookingholdings"
export const COMPANY = "Booking Holdings"
export const CORPORATE_CAREERS_URL = "https://www.bookingholdings.com/careers/careers/"
// The current corporate Careers @ Our Centers of Excellence link declares
// this first-party site; its own Our Jobs link declares the scoped Jibe board.
export const CAREERS_URL = "https://www.bookingholdings-coe.com/bookingholdings-coe/jobs"
export const DISPOSITION = 'runtime-verified-recruitment'
const configuration = recruitmentBatchProviders().find(provider => provider.source === SOURCE)
if (!configuration) throw Error('Missing registered Booking Holdings recruitment source')
const scraper = createVerifiedRecruitmentScraper({ ...configuration, companyCareerPage: CAREERS_URL,
  officialHomepageUrl: CORPORATE_CAREERS_URL, discoverJibeRecruitmentData: true })
export const run = options => scraper.run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
