import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "meetrecord",
  "companyName": "MeetRecord",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "own-outdoo-meetrecord-careers-publications",
  "countryFilter": "India",
  "paginationStrategy": "current-own-legal-brand-careers-opening-and-closing;bounded-exact-whole-India-role-proof",
  "extractionStrategy": "current-first-party-MeetRecord-rebrand-and-legal-operator+exact-whole-native-India-workplace+authored-own-application-handoff;explicit-partials",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Requires current own original MeetRecord/rebrand and legal operator statements, current own-role membership, exact whole authored India workplace, known criteria/dates and active native role application handoffs. City-only cards never use HQ/common hub country defaults. No frozen UI/CSS/programme hashes, role roster, descriptions or native counts admit records. Full renderer, external application controls/backend, actual employing legal entity, company inventory and cleanup remain unverified.",
  "backfillMode": "live-parser",
  "authoritativeCurrentPublication": true,
  "companyCareerPage": "https://www.outdoo.ai/career",
  "scraperTimeoutMs": 240000,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch01/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch01\\meetrecord.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
