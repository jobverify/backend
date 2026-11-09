import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = {
  "source": "alteryx",
  "companyName": "Alteryx",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.alteryx.com/about-us/careers",
  "companyDomain": "alteryx.com",
  "atsPlatform": "workday",
  "countryFilter": "India",
  "paginationStrategy": "next-button",
  "extractionStrategy": "dom+detail-page",
  "parser": "workday",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.alteryx.com/about-us/careers was the live first-party Alteryx careers page and that the public Workday board remained available at https://alteryx.wd108.myworkdayjobs.com/en-US/AlteryxCareers. Verified on the same date that the public Workday jobs API at https://alteryx.wd108.myworkdayjobs.com/wday/cxs/alteryx/AlteryxCareers/jobs returned 74 total postings, exposed the India country facet c4f78be1a8f14da0ab49ce1162348a5e with count 6, and returned 6 live India openings when filtered to that verified India facet. Verified current public first-party India detail pages including Sr. Workday Integration Specialist at https://alteryx.wd108.myworkdayjobs.com/en-US/AlteryxCareers/job/Bangalore-India/Sr-Workday-Integration-Specialist_R12273, Learning Programs Specialist at https://alteryx.wd108.myworkdayjobs.com/en-US/AlteryxCareers/job/India---Remote/Learning-Programs-Specialist_R12227, and CX Operations Specialist at https://alteryx.wd108.myworkdayjobs.com/en-US/AlteryxCareers/job/India---Remote/CX-Operations-Specialist_R12183.",
  "backfillMode": "workday",
  "originalAdapter": "workday",
  "originalAtsPlatform": "workday",
  "originalModulePath": null,
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\myworkday\\alteryx\\jobs.json",
  "baseUrl": "https://alteryx.wd108.myworkdayjobs.com/en-US/AlteryxCareers",
  "officialBrandName": "Alteryx"
}

export default PROVIDER_METADATA
