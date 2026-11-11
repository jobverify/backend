import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "lennoxinternational",
  "companyName": "Lennox International",
  "adapter": "script",
  "atsPlatform": "icims",
  "companyDomain": "lennox.com",
  "companyCareerPage": "https://www.lennox.com/in",
  "officialHomepageUrl": "https://www.lennox.com/in",
  "publisherNames": ["Lennox International"],
  "countryFilter": "India",
  "paginationStrategy": "bounded-native-page-one-with-closing-cohort",
  "extractionStrategy": "corporate-active-handoff-reviewed-native-iframe-own-schema-and-full-visible-criteria-with-closing-reads",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-11",
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "verificationDisposition": "current-native-role-criteria-qualified-company-scope-unverified",
  "verifiedSurfaceSummary": "15 native role models observed in the retained 2026-11-10 UTC capture. Each own schema explicitly supplies country IN and publisher Lennox International. Global and India totals, legal employer, and company scope remain unverified.",
  "backfillMode": "icims",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
