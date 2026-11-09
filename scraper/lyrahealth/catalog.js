import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "lyrahealth",
  "companyName": "Lyra Health",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "lever-public-native",
  "countryFilter": "India",
  "paginationStrategy": "bounded-50-record-native-pages-and-full-closing-models",
  "extractionStrategy": "corporate-declared-account+own-full-JobPosting+visible-whole-role+native-ISO2-country+paired-models",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-05",
  "verifiedPublicJobCount": 482,
  "verifiedIndiaJobCount": 7,
  "verifiedSampleJobTitle": "Affiliate Psychologist - Bhubaneswar",
  "verifiedSampleJobUrl": "https://jobs.lever.co/lyrahealth/ceeb0a25-4b30-4076-a2d2-58773663e720",
  "verifiedSurfaceSummary": "Observed on November 5, 2026: the active corporate careers index, own role and declared Lever application reference bind the Lyra Health public account. Ten 50-record pages preserve 482 original models; seven own ISO2 IN records reconcile with their complete visible pages and own JobPosting schemas at opening and closing across 42 original reads. Lists-only criteria and native calendar publication values are preserved. Four affiliate roles explicitly name Lyra Clinical Associates as their contracting party, separate from publisher Lyra Health. Unknown country, requisition, first-ever publication and undisclosed legal employer stay unknown. Whole company scope, listing completeness and lifecycle cleanup remain unqualified.",
  "backfillMode": "current-native-public",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\lyrahealth.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
