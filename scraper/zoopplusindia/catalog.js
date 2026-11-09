import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zoopplusindia",
  "companyName": "ZoopPlus India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "official-brand-careers-shell-no-current-public-jobs",
  "companyCareerPage": "https://www.zoop.one/career",
  "companyDomain": "zoop.one",
  "countryFilter": "India",
  "paginationStrategy": "single-first-party-careers-shell-validation",
  "extractionStrategy": "verified-official-brand-careers-shell+historical-rendered-role-card-parser+empty-shell-fallback",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-14",
  "verificationDisposition": "verified-current-empty-first-party-careers-shell",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Friday, August 14, 2026 that https://www.zoop.one/career remains the live official ZOOP careers surface reviewed for workbook company ZoopPlus India, but the page now renders a branded no-openings shell with the title \"Career | Join Our Team\", footer contact markers such as sales@zoop.one and grievance@zoop.one, and no current public role cards or Google Forms apply links. This scraper preserves the historical rendered role-card parser if first-party cards reappear, while returning an honest empty result for the current verified shell.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-official-brand-careers-surface-fail-closed",
  "originalModulePath": "../workbookbatch06/zoopplusindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\zoopplusindia.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
