import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zestmoney",
  "companyName": "ZestMoney",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-public-careers-surface-with-dead-external-icims-handoff",
  "companyCareerPage": "https://www.zestmoney.in/join-us-1/",
  "companyDomain": "zestmoney.in",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-public-careers-surface+dead-external-icims-handoff+no-public-listings-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.zestmoney.in/join-us-1/ was the live official public careers surface reviewed for ZestMoney and that it exposed a SEE JOB OPENINGS handoff to https://careers-zestmoney.icims.com/. The linked iCIMS host and standard public search paths returned 404 instead of a trustworthy enumerable public jobs contract, so this company-local scraper stays fail-closed and returns no jobs until a stable first-party or trusted public openings surface is verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-surface-with-dead-external-icims-handoff",
  "originalModulePath": "../workbookbatch06/zestmoney.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\zestmoney.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
