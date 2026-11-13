import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "vahan",
  "companyName": "Vahan",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyDomain": "vahan.co",
  "companyCareerPage": "https://www.vahan.co/careers/",
  "officialHomepageUrl": "https://www.vahan.co/",
  "atsPlatform": "first-party-native-html",
  "countryFilter": "India",
  "paginationStrategy": "complete-current-DOM-board+two-full-detail-passes+final-membership-check;max-100-roles",
  "extractionStrategy": "corporate-own-careers-handoff+reviewed-published-client-and-stylesheets+explicit-role-country+full-original-visible-criteria+same-role-form-binding",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-13",
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Current first-party employer HTML board publishes full native role criteria and explicit role-assigned India countries. Customer delivery jobs under /jobs/ are excluded. Only the published employer board is reconciled; whole-company scope remains unknown and lifecycle cleanup is forbidden.",
  "backfillMode": null,
  "zeroResultPolicy": "evidence-required",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
