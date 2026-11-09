import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROLIFICS_CORPORATION_LTD_CATALOG = {
  "source": "prolificscorporationltd",
  "companyName": "Prolifics Corporation Private Limited",
  "companyCareerPage": "https://prolifics.ai/careers",
  "companyDomain": "prolifics.ai",
  "atsPlatform": "zoho-recruit",
  "officialJobsBoardUrl": "https://prolifics.zohorecruit.in/jobs/Careers",
  "publicJobsApiUrl": "https://prolifics.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite",
  "countryFilter": "India",
  "paginationStrategy": "official-careers-handoff+single-public-feed",
  "extractionStrategy": "verified-official-careers-page+verified-zoho-portal+public-recruit-json+india-filter+test-listing-rejection",
  "verificationDisposition": "verified-public-zoho-recruit-inventory",
  "verifiedPublicJobCount": 27,
  "verifiedIndiaJobCount": 22,
  "verifiedSurfaceSummary": "Verified October 3, 2026: the exact Prolifics Corporation Private Limited Zoho portal now identifies its official website as prolifics.ai. The first-party careers page and exact Zoho tenant/company identity remain verified. The public successful Job_Openings payload contains 27 records and yields 22 published India roles with descriptions after country and test-listing checks.",
  "adapter": "script",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "dryRunFile": "prolificscorporationltd/jobs.json",
  modulePath: path.join(currentDir, 'script.js'),
}

export default PROLIFICS_CORPORATION_LTD_CATALOG
