import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "panasonicindiadigital",
  "companyName": "Panasonic India Digital",
  "officialBrandName": "Panasonic India",
  "adapter": "script",
  "companyCareerPage": "https://www.panasonic.com/in/",
  "companyDomain": "panasonic.com",
  "atsPlatform": "verified-panasonic-india-corporate-handoff-fail-closed",
  "countryFilter": "India",
  "paginationStrategy": "multi-page-corporate-handoff",
  "extractionStrategy": "verified-panasonic-india-public-surfaces+india-careers-handoff-expired-cert+exact-entity-fail-closed",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-03",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Monday, August 3, 2026 that https://www.panasonic.com/in/ and https://www.panasonic.com/in/corporate.html were the live Panasonic India public surfaces reviewed for Panasonic India Digital, that both pages handed off to https://www.panasoniccareersindia.in/, and that the India careers handoff currently failed with CERT_HAS_EXPIRED. Local repo evidence still does not establish that the broader Panasonic India jobs inventory is attributable specifically to the exact workbook entity Panasonic India Digital, so this company-specific scraper remains fail-closed and returns no jobs until an exact-name public openings contract is verified.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "modulePath": path.join(currentDir, 'script.js'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-panasonic-india-corporate-handoff-fail-closed",
  "originalModulePath": "../workbookbatch04/panasonicindiadigital.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\panasonicindiadigital\\jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
