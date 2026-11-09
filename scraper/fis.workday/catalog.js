import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "fis",
  "companyName": "FIS",
  "adapter": "script",
  "atsPlatform": "phenom-native-fis-company-facet",
  "countryFilter": "India",
  "paginationStrategy": "FIS-company-facet-all-country-offsets-total-unique-identities",
  "extractionStrategy": "official-FIGLUS-bootstrap+FIS-filter-echo+native-India-detail+typed-office-corroboration",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "native-runtime-validation-required",
  "verifiedSurfaceSummary": "Official FIS careers handoff to FIGLUS Phenom. Runtime enumerates FIS companyValue across all countries, requires matching native filter echo and totals, then corroborates each India detail by native employer, application, canonical identity and typed postal/city/state/country. Exact native descriptions, addresses and publication fields retained. Original publication provenance and legal employer unverified. No static extraction or eligibility count claimed.",
  "originalModulePath": null,
  "backfillMode": "live-parser",
  "companyCareerPage": "https://www.fisglobal.com/careers",
  "companyDomain": "fisglobal.com",
  "zeroResultPolicy": "evidence-required",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
