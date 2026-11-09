import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = {
  "source": "alation",
  "companyName": "Alation",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.alation.com/careers/all-careers/",
  "companyDomain": "alation.com",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "next-button",
  "extractionStrategy": "dom+detail-page",
  "parser": "workday",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.alation.com/careers/all-careers/ is the live first-party Alation careers page and that it links current openings to the public Workday board at https://alation.wd503.myworkdayjobs.com/en-US/ExternalSite. Verified on the same date that the live Workday surface exposed India openings including People Operations Generalist, Software Engineer II, and Software Engineer III with location marker IND-CHENNAI.",
  "backfillMode": "workday",
  "originalAdapter": "workday",
  "originalAtsPlatform": "workday",
  "originalModulePath": null,
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\myworkday\\alation\\jobs.json",
  "baseUrl": "https://alation.wd503.myworkdayjobs.com/en-US/ExternalSite",
  "officialBrandName": "Alation"
}

export default PROVIDER_METADATA
