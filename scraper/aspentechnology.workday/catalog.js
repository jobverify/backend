import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "aspentechnology",
  "companyName": "Aspen Technology",
  "adapter": "script",
  "atsPlatform": "workday",
  "companyCareerPage": "https://www.aspentech.com/en/careers",
  "companyDomain": "aspentech.com",
  "officialWorkdayBoardUrl": "https://aspentech.wd5.myworkdayjobs.com/aspentech",
  "countryFilter": "India",
  "paginationStrategy": "current-published-native-India-office-facets+native-offset-pages+closing-context",
  "extractionStrategy": "current-company-handoff+typed-India-office-facets+full-original-native-role-models+closing-reconciliation",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-records-company-recruitment-scope-unqualified",
  "verifiedSurfaceSummary": "Follows the current AspenTech careers handoff and native India office facets. Every accepted role retains its original legal employer, structured native country, full description, calendar publication and closing context. Whole-company recruitment scope remains unqualified.",
  "originalModulePath": "../workbookbatch09b/failClosedSentinel.js",
  "backfillMode": "workday",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
