import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "eset",
  "companyName": "ESET",
  "adapter": "script",
  "modulePath": path.resolve(currentDir, '../eset.workday/script.js'),
  "dryRunFile": path.resolve(currentDir, '../eset.workday/jobs.json'),
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "workday-unfiltered-opening-and-closing",
  "extractionStrategy": "current-official-visible-vanity-and-literal-workday-config-with-native-role-guards",
  "parser": "workday",
  "normalizationProfile": "engineering-default",
  "companyDomain": "eset.com",
  "companyCareerPage": "https://www.eset.com/us/about/careers/",
  "baseUrl": "https://eset.wd3.myworkdayjobs.com/ESET_External",
  "locationCountry": null,
  "sourceScopeComplete": false,
  "zeroResultPolicy": "coverage-gap",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "companyGlobalTotal": null,
  "companyIndiaTotal": null,
  "officialBindingVerifiedAt": null,
  "bindingEvidence": null,
  "recruitmentCandidate": null,
  "verifiedSurfaceSummary": "Validate the current official visible handoff to the exact ESET vanity URL and its literal external-CXS tenant/site/canonical identity before using the existing Workday engine and shard admission. Native role, country, full-description, application and date guards apply; unqualified legal-employer names are not aliases. Whole-company inventory, India totals, verified dates and publication remain unknown, including empty board observations.",
  "backfillMode": "workday",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\eset.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
