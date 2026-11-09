import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "aplazo",
  "companyName": "Aplazo",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "ashby",
  "companyDomain": "aplazo.mx",
  "companyCareerPage": "https://www.aplazocareers.mx/",
  "officialHomepageUrl": "https://aplazo.mx/",
  "boardToken": "aplazo",
  "countryFilter": "India",
  "paginationStrategy": "validated-native-single-response-and-independent-closing",
  "extractionStrategy": "current-exact-employer-ashby-handoff-all-native-countries-full-india-details-and-closing",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Current public completeness requires the exact active Aplazo Ashby handoff, all native countries, full selected India details and matching independent closing records plus careers handoff. Native observed counts remain separate from unknown whole-company totals; historical metadata does not certify future checks.",
  "backfillMode": "conditional-current-public-inventory",
  "sourceScopeComplete": false,
  "zeroResultPolicy": "evidence-required",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\aplazo.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
