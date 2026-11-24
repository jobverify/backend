import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recruitmentBatchProviders } from '../../scraper-support/utils/recruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'

export const SOURCE = "bostonproperties"
export const COMPANY = "Boston Properties"
export const CAREERS_URL = "https://edxn.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001"
export const DISPOSITION = 'runtime-verified-recruitment'
// BXP is the publisher on this registered corporate domain and its live Oracle
// handoff. This brand declaration does not establish a separate legal employer.
const registeredProvider = recruitmentBatchProviders().find(provider => provider.source === SOURCE)
if (!registeredProvider) throw new Error('Missing registered Boston Properties recruitment source')
export const run = options => createVerifiedRecruitmentScraper({
  ...registeredProvider,
  publisherNames: [...new Set([...(registeredProvider.publisherNames || []), 'BXP'])],
  requireCorporateIdentityMatch: true,
}).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
