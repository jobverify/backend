import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = {
  "source": "crowdstrikeindia",
  "companyName": "CrowdStrike India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers",
  "companyDomain": "crowdstrike.wd5.myworkdayjobs.com",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "next-button",
  "extractionStrategy": "dom+detail-page",
  "parser": "workday",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedSurfaceSummary": null,
  "backfillMode": "workday",
  "originalAdapter": "workday",
  "originalAtsPlatform": "workday",
  "originalModulePath": null,
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\myworkday\\crowdstrikeindia\\jobs.json",
  "baseUrl": "https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers"
}

export default PROVIDER_METADATA
