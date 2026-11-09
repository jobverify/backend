import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "gcore",
  "companyName": "Gcore",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "smartrecruiters",
  "companyCareerPage": "https://gcore.com/careers",
  "companyDomain": "gcore.com",
  "smartRecruitersBoardUrl": "https://careers.smartrecruiters.com/Gcore",
  "countryFilter": "India",
  "paginationStrategy": "bounded-native-opening-detail-closing",
  "extractionStrategy": "official-gcore-navigation-and-reciprocal-smartrecruiters-native-role-observation",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "October 31 current Gcore Toggle-menu/About Open positions control activates the exact case-sensitive Gcore SmartRecruiters board; the board reciprocates gcore.com/careers. Native company/role/URL identity, explicit role-owned country, unmodified JD and opening/closing inventory are checked at runtime. Board observations are not company totals; missing country, publication, content or scope remain unresolved. No India-zero or company-empty claim.",
  "backfillMode": "native-board-observation",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\gcore.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
