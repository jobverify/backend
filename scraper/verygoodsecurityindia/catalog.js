import {publicLeverMetadata, PUBLIC_LEVER_PROFILES} from '../../scraper-support/native-sources/publicLeverChannels/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA_HISTORICAL = {
  "source": "verygoodsecurityindia",
  "companyName": "Very Good Security India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.verygoodsecurity.com/careers",
  "atsPlatform": "lever",
  "paginationStrategy": "public-lever-api-limit-skip-plus-board-inventory-equality",
  "extractionStrategy": "verified-first-party-careers+matching-vgs-lever-board+complete-public-postings+explicit-india-locations",
  "verifiedOn": "2026-09-13",
  "verifiedSurfaceSummary": "Verified on Sunday, September 13, 2026 that https://www.verygoodsecurity.com/careers exposes the current VGS careers surface and its careers component identifies Lever account verygoodsecurity. The branded public board https://jobs.lever.co/verygoodsecurity and paginated public API https://api.lever.co/v0/postings/verygoodsecurity?mode=json expose matching inventories of 16 public roles and 0 India roles. Every public identity and location is validated before India filtering; unknown locations, pagination truncation, or mismatched inventories fail closed.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-non-enumerable-careers-surface",
  "originalModulePath": "../workbookbatch05/verygoodsecurityindia.js",
  "originalDryRunFile": null
}

const PROVIDER_METADATA = publicLeverMetadata(PUBLIC_LEVER_PROFILES.verygoodsecurityindia, PROVIDER_METADATA_HISTORICAL)

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
