import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "etihadairways",
  "companyName": "Etihad Airways",
  "adapter": "script",
  "atsPlatform": "smartrecruiters",
  "countryFilter": "India",
  "paginationStrategy": "native-opening-and-closing-api-offset-pages",
  "extractionStrategy": "strict-visible-current-employer-handoff-native-company-role-country-original-criteria",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "companyCareerPage": "https://careers.etihad.com/",
  "companyDomain": "etihad.com",
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "companyGlobalTotal": null,
  "companyIndiaTotal": null,
  "sourceScopeComplete": false,
  "zeroResultPolicy": "evidence-required",
  "backfillMode": "native-board-observation",
  "verifiedSurfaceSummary": "The current native collector validates the enabled visible official Etihad handoff and reciprocal EtihadAirways5 board, traverses native opening/closing listings, and hydrates only explicit native public India roles. Native IDs, all supplied URLs, countries, worksites and original criteria remain guarded. Unknown fields and incomplete native criteria remain partial. Observed board counts and an empty India subset do not prove whole-company scope or authoritative company-empty inventory.",
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
