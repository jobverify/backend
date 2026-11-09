import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const AXA_CATALOG={
  "source": "axa",
  "companyName": "AXA",
  "adapter": "script",
  "atsPlatform": "first-party-and-jibe-public-native-json",
  "countryFilter": "India",
  "paginationStrategy": "all-declared-India-candidate-pages-and-details-with-closing-client-pages-board-primary",
  "extractionStrategy": "exact-current-primary+manual-declared-public-redirect+static-Jibe-client+complete-native-JSON-and-authored-detail-criteria",
  "parser": "live-parser",
  "normalizationProfile": "engineering-default",
  "catalogOverride": true,
  "companyCareerPage": "https://careers.axa.com/careers-home/",
  "officialHomepageUrl": "https://www.axa.com/",
  "companyDomain": "axa.com",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "backfillMode": null,
  "runtimeValidation": null,
  "verifiedAt": null,
  "bindingEvidence": null,
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "lifecycleCleanupAllowed": false,
  "zeroResultPolicy": "evidence-required",
  "verificationDisposition": "native-posting-extraction;country-conflicts-and-company-inventory-unresolved",
  "remediationStatus": "native-posting-extraction;country-conflicts-unresolved",
  "verifiedSurfaceSummary": "Current AXA primary declares a public ALL JOBS redirect and anonymous Jibe board/client. Preserve complete native candidate pages, every full detail and closing models before selection,caps,observers or failures. Explicit additional India locations remain eligible; contradictory native country codes stay held. Full company inventory,authoritative India zero,rendered criteria visibility,current hiring/application completion and lifecycle cleanup remain unqualified.",
  "requireNativeEmployerName": true
}
AXA_CATALOG.modulePath=path.join(currentDir,'script.js')
AXA_CATALOG.dryRunFile=path.join(currentDir,'jobs.json')
export const PROVIDER_METADATA=AXA_CATALOG
export default AXA_CATALOG
