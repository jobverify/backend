import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js';
import { createSourceConfig } from './parser.js';
function projectJobs(result) {
  const { jobs, listingRecords, unknownRawFailures, exclusions, retainedResponses, ...summary } = result;
  const compact = { ...summary, extractedDetailJobs: jobs.length, listingRecordCount: listingRecords.length, unknownRawFailureCount: unknownRawFailures.length, excludedDetails: exclusions.length,
    retainedResponses: retainedResponses.map(({ url, status, bodySHA256, bodyBytes, requestedAt, completedAt }) => ({ url, status, bodySHA256, bodyBytes, requestedAt, completedAt })), fullBatchEvidenceOnFirstExtractedJob: true };
  return jobs.map((job, index) => ({ ...job, nativeCollectionEvidence: index === 0 ? result : compact }));
}
const source = () => createFirstPartyHTMLScraper({ ...createSourceConfig(), projectJobs });
export const collect = options => source().collect(options);
export const runNative = options => source().run(options);
