import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "avaamo",
  "companyName": "Avaamo",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-same-origin-job-pages",
  "companyCareerPage": "https://avaamo.ai/career",
  "companyDomain": "avaamo.ai",
  "countryFilter": "India",
  "paginationStrategy": "current-first-party-cards-plus-stable-opening-closing-inventory",
  "extractionStrategy": "current-first-party-framer-cards+canonical-role-content+explicit-country-observations",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-11-05",
  "verificationDisposition": "verified-first-party-same-origin-job-pages",
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Observed on November 5, 2026 that https://avaamo.ai/career publishes 12 canonical Framer role cards with matching opening and closing records and matching detail titles and metadata. Eleven details contain authored role criteria; the Forward Deployed Engineer detail contains only location and company prose. Four locations explicitly say United States and eight have unresolved city-only countries. Counts are native observations, not reported company totals or proof of zero India hiring. Full authored HTML, plain text and native documents are retained; lifecycle cleanup remains disabled.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-same-origin-job-pages",
  "originalModulePath": "../workbookbatch06/avaamo.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\avaamo.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
