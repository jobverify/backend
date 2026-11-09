import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = {
  "source": "f5",
  "companyName": "F5",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.f5.com/company/careers",
  "companyDomain": "f5.com",
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
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\myworkday\\f5\\jobs.json",
  "baseUrl": "https://ffive.wd5.myworkdayjobs.com/f5jobs"
}

export default PROVIDER_METADATA
