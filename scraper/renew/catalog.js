import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const VERIFIED_SURFACE_SUMMARY = "Verified on October 9, 2026: current renew.com growth-opportunities publishes the native ReNew LinkedIn employer profile/company2563081; first-party February 2023 publication verifies ReNew Power rebranded as ReNew. ReNew Jobs public company cards and native JobPosting details provide substantive explicit India descriptions and active application controls. The primary careers.renew.com certificate expired October 6 and remains unenumerated. The LinkedIn subset is always incomplete; company-wide active and India vacancy counts remain unknown. Current native snapshot observed45 publisher cards,28 verified India roles and17 explicit foreign-country exclusions; these observations do not establish total employer inventory."
export const RENEW_CATALOG = {
  source: 'renew',
  companyName: 'ReNew',
  officialBrandName: 'ReNew Power',
  adapter: 'script',
  dryRunFile: 'renew/jobs.json',
  ...{
  "companyCareerPage": "https://www.linkedin.com/jobs/renew-jobs-worldwide?f_C=2563081",
  "verifiedJobsSearchUrl": "https://www.linkedin.com/jobs/renew-jobs-worldwide?f_C=2563081",
  "atsPlatform": "linkedin-employer-public-subset",
  "countryFilter": "India",
  "paginationStrategy": "counted-current-native-company-cards+stable-final-snapshot",
  "extractionStrategy": "first-party-careers+brand-alias+native-company2563081+JobPosting-full-JD+India+active-apply+partial-lifecycle",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "companyDomain": "renew.com",
  "verifiedOn": "2026-10-09",
  "verifiedSurfaceSummary": "Verified on October 9, 2026: current renew.com growth-opportunities publishes the native ReNew LinkedIn employer profile/company2563081; first-party February 2023 publication verifies ReNew Power rebranded as ReNew. ReNew Jobs public company cards and native JobPosting details provide substantive explicit India descriptions and active application controls. The primary careers.renew.com certificate expired October 6 and remains unenumerated. The LinkedIn subset is always incomplete; company-wide active and India vacancy counts remain unknown. Current native snapshot observed45 publisher cards,28 verified India roles and17 explicit foreign-country exclusions; these observations do not establish total employer inventory.",
  "primaryCareersUrl": "https://careers.renew.com/",
  "verifiedLiveActiveJobCount": null,
  "verifiedLiveIndiaJobCount": null,
  "inventoryVerification": {
    "status": "coverage-gap",
    "firstParty": true,
    "listingComplete": false,
    "surface": "https://www.linkedin.com/jobs/renew-jobs-worldwide?f_C=2563081",
    "reportedTotal": null,
    "indiaFacetCount": null,
    "reason": "Employer-published LinkedIn partial subset; primary RMK inventory unenumerated. All outputs sourceListingComplete:false; no empty-inventory expiry."
  }
},
  modulePath: path.join(currentDir, 'script.js'),
}
export default RENEW_CATALOG
