import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "sahamati",
  "companyName": "Sahamati",
  "officialBrandName": "Sahamati",
  "adapter": "script",
  "companyCareerPage": "https://sahamati.org.in/aboutus/",
  "companyDomain": "sahamati.org.in",
  "atsPlatform": "verified-public-surface-fail-closed-sentinel",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-public-company-surface+fail-closed-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://sahamati.org.in/aboutus/ was the live first-party public surface reviewed for Sahamati. This batch only pins the exact workbook name to the verified public company surface, and no batch-04 company-specific openings parser has been promoted yet, so the provider remains fail-closed and returns no jobs until a verifiable public openings flow is implemented.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-surface-fail-closed-sentinel",
  "originalModulePath": "../workbookbatch04/sahamati.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\sahamati\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
