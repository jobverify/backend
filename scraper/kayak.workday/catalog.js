import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "kayak",
  "companyName": "KAYAK",
  "adapter": "script",
  "atsPlatform": "own-published-KAYAK-Ashby",
  "countryFilter": "India",
  "paginationStrategy": "complete-configured-own-SSR-Ashby-models-opening-closing",
  "extractionStrategy": "own-careers-declared-roles-exact-native-organization-ID-board-feed-and-country-reconciliation",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-20",
  "verificationDisposition": "current-configured-own-board-native-publication-and-country-qualified-company-wide-inventory-held",
  "verifiedSurfaceSummary": "Current own KAYAK careers SSR cards, declared exact-organization Ashby board and full native posting models are reconciled at opening and closing. All known native country alternatives are retained; missing criteria remain explicit partials. Complete inventory proof covers only this configured current board; company-wide totals, full application controls and cleanup stay unqualified.",
  "originalModulePath": "../workbookbatch10b/failClosedSentinel.js",
  "backfillMode": "workday",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
