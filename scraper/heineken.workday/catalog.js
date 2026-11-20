import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "heineken",
  "companyName": "Heineken",
  "adapter": "script",
  "atsPlatform": "first-party-drupal-successfactors",
  "countryFilter": "India",
  "paginationStrategy": "current-corporate-native-India-GET-filter-and-declared-continuations",
  "extractionStrategy": "current-own-Heineken-JobPosting+whole-native-India-workplace+exact-authored-application;explicit-partials",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-live-native-reader;runtime-assessment-required",
  "verifiedSurfaceSummary": "Reads the current corporate-declared Heineken publisher, native India GET form and exact own JobPostings. Original public IDs, authored employer/workplaces, criteria/dates and exact native application links are retained. Current role records remain explicit partials; company totals, full renderer/application controls and cleanup are unverified.",
  "authoritativeCurrentPublication": true,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "scraperTimeoutMs": 180000,
  "homepageUrl": "https://www.theheinekencompany.com/",
  "companyCareerPage": "https://careers.theheinekencompany.com/",
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
