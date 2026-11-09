import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../../scraper-support/providers/apiPortalTemplates.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { createSourceConfig, SOURCE, COMPANY, ORIGIN, BOARD, searchURL } from './parser.js'
export const collect = options => createFirstPartyHTMLScraper(createSourceConfig(options)).collect(options)

export async function runNative(options = {}) {
  const result = await collect(options)
  if (!result.jobs.length && result.failures.length) throw Object.assign(Error('Haleon native collection incomplete; cleanup forbidden'), {
    name: 'NativeHTMLIncompleteError', code: 'NATIVE_HTML_INCOMPLETE', nativeEvidence: result })
  const byID = new Map(result.jobs.map(fact => [fact.id, fact]))
  const records = result.jobs.map(fact => ({ ...fact.nativeListingRecord.rawNative, verifiedIndiaLocation: fact.indiaLocations.map(v => v.location).join(' / ') }))
  // Reuse the shared Eightfold mapper against the already fetched, validated
  // India subset. These local replay responses make no additional HTTP calls.
  const provider = expandApiPortalProviderTemplate({ source: SOURCE, companyName: COMPANY, companyCareerPage: BOARD, countryFilter: 'India', atsPlatform: 'eightfold',
    template: 'eightfold', templateOptions: { host: new URL(ORIGIN).hostname, domain: 'haleon.com' }, config: {
      pagination: { strategy: 'single-page' }, mapping: { location: 'verifiedIndiaLocation', applyUrl: { path: 'data', valuePath: 'verifiedApplyURL' } },
      detail: { concurrency: 2 },
    } })
  const mapped = await runApiPortalScraper({ provider, fetchJson: async url => {
    const parsed = new URL(url)
    if (parsed.pathname === '/api/pcsx/search') return { data: { positions: records, count: records.length } }
    requireNative(parsed.pathname === '/api/pcsx/position_details', 'Unexpected local Eightfold replay endpoint')
    const fact = byID.get(parsed.searchParams.get('position_id'))
    requireNative(fact, 'Unobserved local Eightfold role replay')
    return { data: { ...fact.nativeDetail, verifiedApplyURL: fact.nativeApplicationURL } }
  } })
  requireNative(mapped.length === records.length, 'Shared mapper dropped a validated Haleon role')
  const { jobs: details, retainedResponses, listingRecords, unknownRawFailures, ...summary } = result
  const compact = { ...summary, extractedDetailJobs: details.length, listingRecordCount: listingRecords.length, unknownRawFailureCount: unknownRawFailures.length,
    fullBatchEvidenceOnFirstExtractedJob: true, retainedResponses: retainedResponses.map(({ url, status, bodyBytes, bodySHA256, requestedAt, completedAt }) => ({ url, status, bodyBytes, bodySHA256, requestedAt, completedAt })) }
  const jobs = mapped.map((job, index) => {
    const fact = byID.get(String(job.jobId)), native = fact.nativeDetail
    requireNative(job.applyUrl === fact.nativeApplicationURL && job.sourceUrl === fact.sourceURL, 'Shared mapper changed native role/application identity')
    const cities = [...new Set(fact.indiaLocations.map(v => v.city).filter(Boolean))]
    return { ...job, jobId: fact.id, requisitionId: native.displayJobId, city: cities.length === 1 && fact.indiaLocations.every(v => v.city) ? cities[0] : null,
      locations: fact.indiaLocations.map(v => v.location), country: 'India',
      postingDate: new Date(native.postedTs * 1000).toISOString(), closingDate: null,
      remoteStatus: { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' }[native.workLocationOption] || null,
      jobDescription: native.jobDescription, sourceDescription: native.jobDescription,
      nativePostedTs: native.postedTs, nativeCreationTs: native.creationTs ?? null,
      nativeStandardizedLocations: native.standardizedLocations, nativeLocationLabels: native.locations,
      nativeFacts: fact, nativeApplicationURL: fact.nativeApplicationURL, applicationsVisited: false,
      firstEverPublication: null, legalEmployer: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      sourceListingComplete: false, sourceDetailComplete: true, sourceDetailStatus: 'complete',
      nativeCollectionEvidence: index === 0 ? result : compact }
  })
  Object.defineProperty(jobs, Symbol.for('jobverify.native-html-evidence'), { value: result })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: searchURL(0),
    firstParty: result.handoffVerified === true, listingComplete: false, pagesFetched: result.pagesFetched, reportedTotal: result.nativeReportedTotal,
    indiaFacetCount: result.candidateDetails ?? null, verifiedAt: null,
    reason: 'Haleon-global-native-API-pages-and-validated-India-details;whole-employer-scope-unresolved;cleanup-forbidden;state=' + result.status })
}
