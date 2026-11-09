import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recruitmentBatchProviders } from '../../scraper-support/utils/recruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'

export const SOURCE = "corning"
export const COMPANY = "Corning"
export const CAREERS_URL = "https://careers.corning.com/us/en"
export const DISPOSITION = 'runtime-verified-recruitment'
// The current corporate page declares Phenom account CUWCUPUS and its native
// India facet. Read that literal configuration and its full role pages instead
// of spending discovery on the older SuccessFactors navigation surface.
const scraper = createVerifiedRecruitmentScraper({
  ...recruitmentBatchProviders().find(provider => provider.source === SOURCE),
  discoverLiteralRecruitmentData: true,
  prioritizeRecruitmentRoleDetails: true,
})
export const run = options => scraper.run({ maxDetails: 40, ...options })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
