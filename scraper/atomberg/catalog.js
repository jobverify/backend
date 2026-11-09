import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const VERIFIED_SURFACE_SUMMARY="The configured Atomberg careers route currently redirects to /pages/careers. Its visible public recruiting contact asks for resumes at career@atomberg.com. Runtime verifies this exact current handoff and public employer contact twice, retains hiring observations with unknown vacancy/work-country scope and stops on public denial. Retail customer login, guessed alternate404 routes and private applications are not employee-inventory prerequisites. No company-wide vacancy zero or cleanup is authorized."
export const ATOMBERG_CATALOG={...{
  "source": "atomberg",
  "companyName": "Atomberg",
  "officialBrandName": "Atomberg",
  "adapter": "script",
  "dryRunFile": "atomberg/jobs.json",
  "companyCareerPage": "https://atomberg.com/careers",
  "homepageUrl": "https://atomberg.com/",
  "applicationEmail": "career@atomberg.com",
  "applicationUrl": "mailto:career@atomberg.com",
  "noPublicJobRouteUrls": [
    "https://atomberg.com/jobs"
  ],
  "brokenCareerRouteUrl": "https://atomberg.com/career",
  "companyDomain": "atomberg.com",
  "atsPlatform": "official-public-email-hiring-contact",
  "countryFilter": "India",
  "paginationStrategy": "current-configured-redirect+public-careers-contact+closing",
  "extractionStrategy": "first-party-employer-contact-observations+unknown-vacancy-country-and-company-scope",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "coverage-gap",
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "lifecycleCleanupAllowed": false
},verifiedSurfaceSummary:VERIFIED_SURFACE_SUMMARY,modulePath:path.resolve(currentDir,'script.js')}
export default ATOMBERG_CATALOG
