import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "priceline",
  "companyName": "Priceline",
  "adapter": "script",
  "atsPlatform": "current-own-native-Priceline-publication-and-declared-Workday-handoffs",
  "companyDomain": "priceline.com",
  "homepageUrl": "https://careers.priceline.com/",
  "companyCareerPage": "https://careers.priceline.com/?s=&post_type=job",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "countryFilter": "India",
  "paginationStrategy": "paired-current-own-home-publisher-search-publications;optional-own-role-detail-pairs;company-allchannels-unverified",
  "extractionStrategy": "current-own-Priceline-publisher+actual-native-role-title-ID-whole-workplace+same-ID-authored-application;valid-partials-and-all-original-models",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedJobCount": null,
  "verifiedPublicJobCount": null,
  "verifiedGlobalJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Pairs the current own homepage declaration, explicit Life at Priceline publisher and native public job-search HTML. Exact whole Mumbai workplaces qualify only through retained independent government originals. Native public display IDs, original CMS post identities, all criteria/date variants and same-ID declared Workday application URLs remain separately retained; formal requisition and legal employer remain null absent explicit authored evidence. Original WebPage.datePublished is CMS page publication, not asserted as job posting/requisition age. Actual title/app/workplace/availability conflicts hold affected roles. No delegated ATS reads, full controls/backend activation, complete listing/company/allchannels/facet totals or cleanup replacement claim.",
  "originalModulePath": "../workbookbatch09e/failClosedSentinel.js",
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
