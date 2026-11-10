import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recruitmentBatchProviders } from '../../scraper-support/utils/recruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'
import { FACTSET_CAREERS, FACTSET_NATIVE_EMPLOYER, FACTSET_WORKDAY, readFactSetPublisherDeclaration } from './currentPublisher.js'

export const SOURCE = "factsetresearchsystems"
export const COMPANY = "FactSet Research Systems"
export const CAREERS_URL = "https://www.factset.com/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
const scraper = createVerifiedRecruitmentScraper({
  ...recruitmentBatchProviders().find(provider => provider.source === SOURCE),
  officialHomepageUrl: FACTSET_CAREERS,
  publisherNames: ['FactSet'],
  nativeEmployerNames: [FACTSET_NATIVE_EMPLOYER],
  nativeWorkdayLegalEmployerNames: [FACTSET_NATIVE_EMPLOYER],
  requireCorporateIdentityMatch: true,
  requireNativeEmployerName: true,
  reconcileWorkdayNativeContext: true,
  nativeWorkdayOrigin: FACTSET_WORKDAY.origin,
  nativeWorkdayTenant: FACTSET_WORKDAY.tenant,
  nativeWorkdaySiteId: FACTSET_WORKDAY.site,
  readCurrentPublisherDeclaration: readFactSetPublisherDeclaration,
})
export const run = async options => {
  const jobs = await scraper.run({ maxRequests: 96, ...options })
  for (const job of jobs) if (job.nativeLegalEmployer === FACTSET_NATIVE_EMPLOYER) Object.assign(job, {
    // company is persisted by the standard normalizer; preserve the actual
    // native legal entity there as well as in the detailed runtime proof.
    company: FACTSET_NATIVE_EMPLOYER,
    nativeEmployerBinding: { method: 'verified-subsidiary-on-current-official-board',
      registeredCompany: COMPANY, nativeLegalEmployer: FACTSET_NATIVE_EMPLOYER,
      boardURL: job.sourceOfficialBinding.matchedLinks[0],
      currentHandoffRechecked: job.sourceOfficialBinding.currentHandoffRechecked === true },
  })
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
