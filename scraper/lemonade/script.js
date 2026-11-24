import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remainingRecruitmentBatchProvider } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import { collectCurrentPublications } from './currentPublications20261121.js'

export const SOURCE = "lemonade"
export const COMPANY = "Lemonade"
export const CAREERS_URL = "https://www.mylemonade.io/career/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
// The registered bare host fails normal TLS hostname verification. Its
// certificate-named public host declares this same current careers path.
const registeredProvider = remainingRecruitmentBatchProvider(SOURCE)
export const run = options => collectCurrentPublications({
  ...registeredProvider,
  officialHomepageUrl: 'https://www.mylemonade.io/',
  companyCareerPage: CAREERS_URL,
}, { preferIndiaInventory: true, ...options })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
