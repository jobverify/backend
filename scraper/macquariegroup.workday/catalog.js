import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "macquariegroup",
  "companyName": "Macquarie Group",
  "adapter": "script",
  "atsPlatform": "current-own-native-Avature-public-country-form-and-server-publication",
  "companyCareerPage": "https://www.macquarie.com/in/en/careers.html",
  "companyDomain": "macquarie.com",
  "countryFilter": "India",
  "paginationStrategy": "current-own-India-handoff+actual-native-Countries-India-form-with-cleared-city+literal302-query+all-Next-links-bounded12pages-two-observations;company-scope-held",
  "extractionStrategy": "current-own-Macquarie-Group-Avature-account46-publisher+actual-selected-native-India-country-scope+same-native-publicID-title-office-Posted-Date-Apply;paired-optional-same-role-canonical-criteria-and-same-ID-ApplicationMethods-URI;all-native-date-criteria-variants;valid-partials;legal-formal-requisition-renderer-backend-company-cleanup-held",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedGlobalJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Current own India careers page declares native Search open roles. Its actual native public search form retains the selected Countries=India value and clears city/other filters, then follows its302 query and complete native Next links twice. Actual card Posted Date labels preserve authored day precision, future publication is held, and generic detail Date fields stay separate. Optional current same-ID role criteria and ApplicationMethods links qualify partials; legal/formal requisition, renderer/backend, company/all-channel inventory and cleanup remain unverified.",
  "backfillMode": "live-parser",
  "scraperTimeoutMs": 360000,
  "authoritativeCurrentPublication": true,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
