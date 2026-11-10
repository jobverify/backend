import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "factsetresearchsystems",
  "companyName": "FactSet Research Systems",
  "adapter": "script",
  "atsPlatform": "official-company-cms-workday",
  "companyDomain": "factset.com",
  "companyCareerPage": "https://www.factset.com/careers",
  "officialHomepageUrl": "https://www.factset.com/",
  "countryFilter": "India",
  "paginationStrategy": "bounded-native-candidate-pagination-with-opening-and-closing-context",
  "extractionStrategy": "current-official-vite-cms-declaration+native-workday+reviewed-subsidiary-employer+explicit-india+full-criteria",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-10",
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "runtime-current-publisher-native-subsidiary-partial-inventory",
  "verifiedSurfaceSummary": "Current FactSet careers Vite/CMS declarations lead to the FactSetCareers Workday board. Reviewed subsidiary roles retain the exact native legal employer, typed India countries, full criteria, original dates, and opening/closing native and publisher context. Candidate selection does not establish a complete company inventory; cleanup remains forbidden.",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "backfillMode": "workday",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
