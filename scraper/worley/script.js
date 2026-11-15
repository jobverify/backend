import {createCatalogScraper, getScraperCatalog} from '../../scraper-support/providers/index.js'
import {plainNativeHTML} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence, readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE = 'worley'
export const COMPANY = 'Worley'
const authoringInstruction = /\brecruiter\s+to\s+(?:copy|paste)\b/i

// A native HTTP200 can still contain an unfinished recruiter template. Keep
// the complete original string for accepted roles and for quarantine evidence.
export function qualifyWorleyCriteria(jobs) {
  const qualified = [], failures = [], evidence = readInventoryEvidence(jobs)
  for (const job of jobs) {
    const html = job.jobDescription
    const text = typeof html === 'string' ? plainNativeHTML(html).normalize('NFKC') : ''
    if (!text.trim() || authoringInstruction.test(text)) {
      failures.push({stage:'native-detail', nativeJobId:String(job.jobId),
        sourceUrl:job.sourceUrl, failureKind:'native-role-criteria-unavailable',
        reason:text.trim() ? 'explicit-recruiter-authoring-placeholder' : 'missing-native-criteria-text',
        sourceDetailComplete:false, nativeDescription:html ?? null,
        nativeRole:{...job}})
      continue
    }
    qualified.push({...job, sourceScopeComplete:false, sourceCompanyCoverageComplete:false,
      lifecycleCleanupAllowed:false,
      ...(failures.length || evidence?.listingComplete !== true ? {sourceListingComplete:false} : {}),
      sourceCriteriaQualification:'original-native-description-with-recruiter-authoring-placeholders-rejected'})
  }
  // A later rejected role also limits earlier accepted roles from this cohort.
  if (failures.length) for (const job of qualified) job.sourceListingComplete = false
  const audit = {source:SOURCE, recordKind:'vacancy-rows',
    observedRecordCount:jobs.length, observedVacancyCount:jobs.length,
    candidateDetails:jobs.length, extractedDetailJobs:qualified.length,
    failures, nativeAcquisitionEvidence:evidence, sourceScopeComplete:false,
    lifecycleCleanupAllowed:false, companyGlobalTotal:null, companyIndiaTotal:null,
    criteriaVerificationScope:'Native description text only; rendered client, media, application and whole-company coverage are unverified'}
  attachSourceObservationEvidence(qualified, audit)
  Object.defineProperty(qualified, 'nativeCollectionEvidence', {value:audit, configurable:true})
  return attachInventoryEvidence(qualified, {...evidence, lifecycleCleanupAllowed:false,
    ...(failures.length ? {status:'coverage-gap', listingComplete:false,
      reason:[evidence?.reason, 'unqualified-native-role-criteria:' + failures.length].filter(Boolean).join(';')} : {})})
}

export async function run(options = {}) {
  const provider = getScraperCatalog().find(row => row.source === SOURCE)
  if (!provider || provider.atsPlatform !== 'eightfold'
    || provider.config?.discovery?.listingApiUrl !== 'https://jobs.worley.com/api/pcsx/search'
    || provider.templateOptions?.domain !== 'worley.com') throw Error('Unexpected Worley native provider configuration')
  // Reuse the original adapter, fetch/error handling, country/identity guards,
  // pagination, pacing and request deadlines. Only qualification is source local.
  const jobs = await createCatalogScraper({...provider, adapter:'apiPortal', modulePath:null}).run(options)
  options.signal?.throwIfAborted()
  return qualifyWorleyCriteria(jobs)
}
