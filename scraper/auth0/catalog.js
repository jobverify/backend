import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "auth0",
  "companyName": "Auth0",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "official-first-party-drupal-job-board",
  "countryFilter": "India",
  "companyCareerPage": "https://auth0.com/careers",
  "canonicalInventorySource": "okta",
  "paginationStrategy": "current-auth0-redirect-and-canonical-okta-native-listing",
  "extractionStrategy": "current-relationship-guard-and-canonical-native-extraction",
  "parser": "current-official-redirect-canonical-source",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "zeroResultPolicy": "evidence-required",
  "verifiedSurfaceSummary": "Recheck the official Auth0 careers redirect and active Okta careers-to-board binding before executing the canonical native Okta extractor. Preserve Okta job ownership, descriptions and inventory evidence. Separate Auth0 employer inventory is unverified.",
  "backfillMode": "live-parser",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\auth0.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
