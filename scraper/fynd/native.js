import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js';
import { CONFIG } from './parser.js';
function compactEvidence(result) {
  const { jobs, listingRecords, retainedResponses, unknownRawFailures, ...summary } = result;
  return { ...summary, extractedDetailJobs: jobs.length, listingRecordCount: listingRecords.length, unknownRawFailureCount: unknownRawFailures.length, retainedResponses: retainedResponses.map(({ rawBodyBase64, ...response }) => response), fullBatchEvidenceOnFirstExtractedJob: true };
}
export function projectJobs(result) {
  const compact = compactEvidence(result);
  return result.jobs.map((fact, index) => ({
    source: 'fynd', company: 'Fynd', jobId: fact.id, id: fact.id,
    nativeInternalID: fact.id, nativePublicToken: fact.publicToken, requisitionId: null,
    identifierSemantics: 'Native internal primary job ID is the persistence key; public URL token is a mutable alias.',
    title: fact.title, sourceUrl: fact.sourceURL, link: fact.nativeApplicationURL, applyUrl: fact.nativeApplicationURL,
    nativeApplicationURL: fact.nativeApplicationURL, applicationLinkSource: 'native-login-handoff-for-matching-internal-job-ID', applicationVisited: false,
    location: fact.nativeGeography.rawLocation, country: fact.nativeGeography.country, countryCode: null,
    city: fact.nativeGeography.city, state: fact.nativeGeography.region, nativeLocationEvidence: fact.nativeGeography,
    postingDate: fact.nativePublication.raw, postedAt: fact.nativePublication.raw,
    nativePublicationDate: fact.nativePublication.raw, nativePublicationPrecision: fact.nativePublication.precision,
    closingDate: null, sourceClosingDateIsExact: false, firstEverPublication: null, legalEmployer: null,
    nativeHiringOrganization: fact.nativeJob.organization, employmentType: fact.nativeJob.employmentType,
    jobDescription: fact.descriptionHTML, sourceDescription: fact.descriptionHTML,
    nativeVisibleDescriptionHTML: fact.nativeVisibleDescriptionHTML,
    nativeSupplementalQualificationsHTML: fact.nativeSupplementalQualificationsHTML,
    descriptionProvenance: 'Complete visible native role HTML and escaped additional first-party model qualification fields; supplemental fields are not claimed visible in the captured page.',
    nativeJobPosting: null, nativeFacts: fact,
    sourceDetailComplete: true, sourceDetailStatus: 'complete', sourceListingComplete: false,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, publicEligibility: null,
    // Keep complete batch bodies once; do not duplicate every response84times.
    nativeCollectionEvidence: index === 0 ? result : compact,
  }));
}
const scraper = createFirstPartyHTMLScraper({ ...CONFIG, projectJobs });
export const collect = scraper.collect;
export const runNative = scraper.run;
