import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remainingRecruitmentBatchProvider } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'

export const SOURCE = "kotakmahindrabank"
export const COMPANY = "Kotak Mahindra Bank"
export const CAREERS_URL = "https://www.kotak.bank.in/en/about-us/careers/kotak-values.html"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
export const run = options => createVerifiedRecruitmentScraper({
  ...remainingRecruitmentBatchProvider(SOURCE),
  nativeOracleDescriptionEmployerDeclaration: {
    kind: 'native-role-organization-label', field: 'ExternalDescriptionStr',
    label: 'Organization Name', name: 'Kotak Mahindra Bank Ltd',
  },
  nativeOracleRoleWorkplaceDeclarations: [{
    kind: 'native-role-workplace-statement', field: 'ExternalDescriptionStr', id: '273830',
    title: 'Legal Manager_CREDIT CARD_0233_4673_1099259_HRR', name: 'Kotak Mahindra Bank',
    position: 'Legal Manager – Credit Card – Hardship Assistance Unit',
    statement: 'Legal Manager – Credit Card – Hardship Assistance Unit at Kotak Mahindra Bank manages the legal and regulatory aspects of credit card customer hardship, debt restructuring, and dispute resolution.',
  }],
}).run({ preferIndiaInventory: true, ...options })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
