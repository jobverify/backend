import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recruitmentBatchProviders } from '../../scraper-support/utils/recruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'

export const SOURCE = "brookfieldassetmanagement"
export const COMPANY = "Brookfield Asset Management"
export const CAREERS_URL = "https://www.brookfield.com/careers/career-opportunities"
export const DISPOSITION = 'runtime-verified-recruitment'
export const REVIEWED_NATIVE_EMPLOYERS = Object.freeze([
  'Brooksolutions Global Services Pvt Ltd',
  'Brooksolutions Global Services Private Limited',
])
export const LEGAL_EMPLOYER_RELATIONSHIP = Object.freeze({
  kind: 'issuer-filed-consolidated-subsidiary-list',
  documentURL: 'https://www.sec.gov/Archives/edgar/data/1937926/000162828026013098/exhibit211.htm',
  documentSha256: 'a956970acd5e29f6fb19e700b4b8db8e4a53d8f7316f6fd71b247ac5f5f26e8d',
  issuer: 'Brookfield Asset Management Ltd.',
  asOf: '2025-12-31',
  filedLegalEmployer: 'Brooksolutions Global Services Private Limited',
  jurisdiction: 'India',
  qualification: 'Exact reviewed employer relationship only; the jurisdiction does not establish a role work country.',
})
const nativeOrigin = 'https://brookfield.wd5.myworkdayjobs.com'
const contractError = message => Object.assign(new Error('Brookfield current native context: ' + message), {
  abortRetries: true, softFailure: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false,
})
export const run = async (options = {}) => {
  const registered = recruitmentBatchProviders().find(provider => provider.source === SOURCE)
  if (!registered || registered.companyName !== COMPANY || registered.companyCareerPage !== CAREERS_URL)
    throw contractError('registered source identity changed')
  const jobs = await createVerifiedRecruitmentScraper({
    ...registered,
    nativeEmployerNames: [...REVIEWED_NATIVE_EMPLOYERS],
    nativeWorkdayLegalEmployerNames: [...REVIEWED_NATIVE_EMPLOYERS],
    requireNativeEmployerName: true,
    reconcileWorkdayNativeContext: true,
    nativeWorkdaySiteId: 'brookfield',
    sourceScopeComplete: false,
    lifecycleCleanupAllowed: false,
  }).run(options)
  for (const job of jobs) {
    const employer = job.nativeHiringOrganization?.name
    let role
    try { role = new URL(job.sourceUrl) } catch { throw contractError('own role URL is unavailable') }
    const binding = job.sourceOfficialBinding, closing = job.sourceNativeClosingContext
    if (!REVIEWED_NATIVE_EMPLOYERS.includes(employer) || job.nativeLegalEmployer !== employer
      || job.nativeSourceRecord?.hiringOrganization?.name !== employer
      || job.nativeClosingSourceRecord?.hiringOrganization?.name !== employer)
      throw contractError('own legal employer is outside the exact reviewed names')
    if (role.origin !== nativeOrigin || !role.pathname.startsWith('/brookfield/job/')
      || binding?.officialURL !== CAREERS_URL || binding.currentHandoffRechecked !== true
      || binding.closingURL !== CAREERS_URL || closing?.allSelectedListingPagesRechecked !== true
      || closing.eachFullRoleRechecked !== true)
      throw contractError('current corporate handoff or closing native role/listing proof is unavailable')
    if (job.country !== 'India' || job.sourceScopeComplete !== false || job.lifecycleCleanupAllowed !== false)
      throw contractError('own India country or partial inventory guards changed')
    job.nativeLegalEmployerRelationshipEvidence = { ...LEGAL_EMPLOYER_RELATIONSHIP, nativeLegalEmployer: employer,
      currentCorporateHandoff: CAREERS_URL, currentNativeOrigin: nativeOrigin }
  }
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
