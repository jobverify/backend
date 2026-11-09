import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "checkmarx",
  "companyName": "Checkmarx",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyDomain": "checkmarx.com",
  "officialHomepageUrl": "https://checkmarx.com/",
  "companyCareerPage": "https://checkmarx.com/company/careers/",
  "jobsBoardUrl": "https://www.comeet.com/jobs/checkmarx/C0.008",
  "atsPlatform": "comeet-public-native-preloads",
  "countryFilter": "India",
  "paginationStrategy": "complete-current-native-position-array-and-stable-full-recheck",
  "extractionStrategy": "current-native-company-identity-typed-country-public-status-and-full-native-content-sections",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "verifiedSurfaceSummary": "Current public native company identity, position UIDs, typed country/location, internal visibility and full native content are checked at runtime. Native update clocks remain separate; posting/closing dates and whole-company totals remain unknown.",
  "backfillMode": "implemented",
  "remediationStatus": "implemented-runtime-partial",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\checkmarx.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
