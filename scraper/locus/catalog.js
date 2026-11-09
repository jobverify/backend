import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "locus",
  "companyName": "Locus",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-handoff-plus-darwinbox",
  "companyCareerPage": "https://locus.sh/careers/",
  "companyDomain": "locus.sh",
  "countryFilter": "India",
  "paginationStrategy": "native-darwinbox-page-size-to-reported-job-count",
  "extractionStrategy": "verified-official-darwinbox-handoff+native-public-listing-api+india-description-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "officialJobsBoardUrl": "https://locus.darwinbox.in/ms/candidate/careers",
  "detailUrlPattern": "https://locus.darwinbox.in/ms/candidatev2/main/careers/jobDetails/{job_id}",
  "verifiedOn": "2026-10-03",
  "verificationDisposition": "verified-public-darwinbox-inventory",  "verifiedPublicJobCount": 8,
  "verifiedIndiaJobCount": 5,
  "verifiedSurfaceSummary": "Verified October 3, 2026: the redesigned official Locus careers Explore Open Roles CTA links to the exact locus.darwinbox.in tenant. After seeding the public careers session, its native successful listing payload reports 8 jobs; all 8 records are retrieved and 5 unique India jobs retain full descriptions. Runtime evidence records complete inventory. Earlier anonymous direct and browser requests returned HTTP 403; the supported native public-session flow succeeded on two fresh replays. The old Freshteam board is no longer the official handoff.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-freshteam-jobs-board",
  "originalModulePath": "../workbookbatch03/locus.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch03\\locus.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
