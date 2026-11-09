import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "piramalpharmadigital",
  "companyName": "Piramal Pharma Digital",
  "officialBrandName": "Piramal Pharma",
  "adapter": "script",
  "companyCareerPage": "https://www.piramalpharma.com/",
  "companyDomain": "piramalpharma.com",
  "atsPlatform": "verified-piramal-pharma-workday-handoff-fail-closed",
  "countryFilter": "India",
  "paginationStrategy": "multi-page-careers-handoff",
  "extractionStrategy": "verified-public-surface+careers-handoff+known-workday-board+exact-entity-fail-closed",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-04",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Tuesday, August 4, 2026 that https://www.piramalpharma.com/ and https://www.piramalpharma.com/careers were the live Piramal Pharma public surfaces reviewed for the exact workbook entity Piramal Pharma Digital, and that the careers page handed applicants to the public Workday board at https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS. Local repo evidence does not safely attribute the broader Piramal Pharma careers inventory to the exact workbook entity Piramal Pharma Digital, so this company-specific scraper remains fail-closed and returns no jobs until an exact-name public openings contract is verified.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-piramal-pharma-workday-handoff-fail-closed",
  "originalModulePath": "../workbookbatch04/piramalpharmadigital.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\piramalpharmadigital\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
