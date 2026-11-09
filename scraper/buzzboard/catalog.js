import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "buzzboard",
  "companyName": "BuzzBoard",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-jazzhr-board",
  "companyCareerPage": "https://www.buzzboard.ai/careers/",
  "companyDomain": "buzzboard.ai",
  "countryFilter": "India",
  "paginationStrategy": "verified-public-jobs-board",
  "extractionStrategy": "verified-first-party-careers-page+public-jazzhr-board+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "verified-public-jazzhr-board",
  "verifiedPublicJobCount": 2,
  "verifiedIndiaJobCount": 2,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.buzzboard.ai/careers/ was the live first-party BuzzBoard careers surface, that it handed applicants to the public JazzHR board at https://buzzboard.applytojob.com/apply, and that the board plus linked public apply pages exposed trustworthy current openings including Associate Product Manager / Product Manager and Software Engineer (Node JS Developer). This scraper validates those verified surfaces and returns the public BuzzBoard openings.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-jazzhr-board",
  "originalModulePath": "../workbookbatch06/buzzboard.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\buzzboard.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
