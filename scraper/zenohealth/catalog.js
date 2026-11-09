import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zenohealth",
  "companyName": "Zeno Health",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "first-party-shell-no-public-openings",
  "companyCareerPage": "https://corporate.zeno.health/careers",
  "companyDomain": "corporate.zeno.health",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-first-party-shell+legacy-linkedin-handoff-fallback+no-first-party-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-14",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Friday, August 14, 2026 that https://corporate.zeno.health/careers now serves a generic first-party Zeno Health shell with the title \"Zeno Health\", the healthcare-brand meta description, and first-party runtime assets, but no longer exposes the earlier careers copy or LinkedIn openings handoff. No trustworthy public openings flow or ATS links were present in the fetched public contract, so this company-local scraper stays fail-closed and returns no jobs until a verifiable openings surface reappears.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-surface-with-linkedin-openings-handoff",
  "originalModulePath": "../workbookbatch06/zenohealth.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\zenohealth.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
