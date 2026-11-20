import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "mantruckandbus",
  "companyName": "MAN Truck & Bus",
  "companyCareerPage": "https://www.mantruckandbusindia.com/en/career/career.html",
  "adapter": "script",
  "atsPlatform": "first-party-aem-darwinbox",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "countryFilter": "India",
  "paginationStrategy": "current-corporate-declared-India-careers-and-bounded-own-role-publication-closing",
  "extractionStrategy": "native-regional-publisher+same-role-India-hiring-statement+original-criteria-dates-and-exact-authored-application;explicit-partials",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Current global MAN country-site declaration binds the own India publisher and current regional legal operator without relabelling the role employing legal entity. Each own role requires an explicit authored India hiring workplace, current membership, known publication facts and exact native application handoff. Original criteria, dates, title variants and duplicate published pages remain retained as partials. Full company inventory, application activation and cleanup remain unverified.",
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
