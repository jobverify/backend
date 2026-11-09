import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "carousellindia",
  "companyName": "Carousell India",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-public-smartrecruiters-board-plus-public-jobs-api",
  "companyCareerPage": "https://careers.smartrecruiters.com/CarousellGroup",
  "companyDomain": "careers.smartrecruiters.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-public-jobs-api",
  "extractionStrategy": "verified-public-smartrecruiters-board+public-jobs-api+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-01",
  "verificationDisposition": "verified-public-smartrecruiters-jobs-api",
  "verifiedPublicJobCount": 46,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://careers.smartrecruiters.com/CarousellGroup remained the accessible public Carousell Group careers board for this workbook source, that its Home Page link now resolves to https://careers.carousell.com/who-we-are/, and that the public SmartRecruiters postings API at https://api.smartrecruiters.com/v1/companies/CarousellGroup/postings?limit=100 exposed current public Carousell Group openings but no India postings in the live payload. Direct fetches to https://careers.carousell.com/ still returned a Cloudflare challenge in this environment, so this scraper validates the public SmartRecruiters board and returns India jobs only from the public SmartRecruiters API.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-smartrecruiters-board-plus-public-jobs-api",
  "originalModulePath": "../workbookbatch06/carousellindia.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\carousellindia.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
