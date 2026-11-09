import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "trigyn",
  "companyName": "Trigyn",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.trigyn.com/careers",
  "atsPlatform": "first-party-drupal-native-career-api",
  "paginationStrategy": "all-native-region-options+zero-based-20-row-pages+independent-India-facet+stable-full-snapshots",
  "extractionStrategy": "official-careers-client-binding+native-region-universe+complete-region-pagination+unique-node-and-position-identities+identity-matched-visible-native-details",
  "verifiedOn": "2026-10-23",
  "verifiedSurfaceSummary": "Captured the official Trigyn careers page, its linked client script, all six regional POST /get-career-data inventories, the independent India facet and all 227 linked detail pages on 2026-10-23. Regional totals 125/54/30/16/1/1 reconcile to 227 unique roles; India country facet reconciles to 40. The careers page initially renders an empty AJAX wrapper and the browser defaults to India using geo-IP. An unfiltered request without region returns HTTP500. Runtime enumerates the native region universe, validates every 20-row page and a second complete snapshot, and retains missing descriptions as nullable partial rows. Source publication dates are absent and remain null.",
  "nativeJobsApiUrl": "https://www.trigyn.com/get-career-data",
  "captureManifest": path.join(currentDir, 'fixtures', 'capture-manifest.json'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-empty-drupal-listing-wrapper",
  "originalModulePath": "../workbookbatch05/trigyn.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
