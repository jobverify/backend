import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const VERIFIED_SURFACE_SUMMARY="The configured public Avanse career page currently exposes employer culture content. In the current default HTTP200 capture its entire old Job Openings template and getAllJobs client are inside an HTML comment. They are inactive investigation evidence, not active job inventory or a current API handoff. A subsequent ordinary public browser navigation returnedHTTP403; no alternate route/client retry was attempted. Runtime does not probe the dormant API, customer loan applications, private sessions or guessed404 routes. Vacancy/work-country/company totals and cleanup remain unverified."
export const AVANSE_CATALOG={...{
  "source": "avanse",
  "companyName": "Avanse",
  "officialBrandName": "Avanse Financial Services",
  "adapter": "script",
  "dryRunFile": "avanse/jobs.json",
  "companyCareerPage": "https://www.avanse.com/career",
  "homepageUrl": "https://www.avanse.com/",
  "jobsApiUrl": "https://www.avanse.com/public/api/getAllJobs?city=mumbai",
  "companyDomain": "avanse.com",
  "atsPlatform": "official-public-careers-culture-page",
  "countryFilter": "India",
  "paginationStrategy": "current-configured-public-careers-page+closing-scope-observations",
  "extractionStrategy": "active-employer-culture-surface+inactive-commented-jobs-evidence+unknown-vacancy-scope",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "jobsApiActive": false,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "coverage-gap",
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "lifecycleCleanupAllowed": false
},verifiedSurfaceSummary:VERIFIED_SURFACE_SUMMARY,modulePath:path.resolve(currentDir,'script.js')}
export default AVANSE_CATALOG
