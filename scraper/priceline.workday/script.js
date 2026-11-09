import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remainingRecruitmentBatchProvider } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'

export const SOURCE = "priceline"
export const COMPANY = "Priceline"
export const CAREERS_URL = "https://careers.priceline.com/life-at-priceline/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
// This current publisher page names Priceline before discovery reaches its
// role-bound Workday handoff. The generic homepage has no employer title/H1.
const scraper = createVerifiedRecruitmentScraper({
  ...remainingRecruitmentBatchProvider(SOURCE),
  officialHomepageUrl: CAREERS_URL,
  reconcileWorkdayNativeContext: true,
})
export const run = options => scraper.run({ maxRequests: 96, maxDetails: 40, ...options })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
