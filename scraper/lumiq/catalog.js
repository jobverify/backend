import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LUMIQ_CATALOG = {
  "source": "lumiq",
  "companyName": "Lumiq",
  "officialBrandName": "LUMIQ",
  "adapter": "script",
  "homepageUrl": "https://www.lumiq.ai/",
  "companyCareerPage": "https://www.lumiq.ai/careers/",
  "officialZohoBoardUrl": "https://lumiq.zohorecruit.in/careers",
  "jobsApiUrl": "https://lumiq.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite",
  "companyDomain": "lumiq.ai",
  "atsPlatform": "zohorecruit",
  "countryFilter": "India",
  "paginationStrategy": "complete-embedded-board-and-public-api-id-reconciliation",
  "extractionStrategy": "verified-first-party-current-zoho-handoff+embedded-board-and-api-id-match+india-job-details",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-09-13",
  "verifiedSurfaceSummary": "Verified September 13, 2026: https://www.lumiq.ai/careers/ links https://lumiq.zohorecruit.in/careers. The current Jobs at Lumiq board embeds the complete seven-job collection used by its client-side listing. The public Job_Openings API for page Careers matches all seven IDs and countries; all seven are explicit India roles including Lead DevOps Engineer. Each India detail is validated against its listing ID, title and country and supplies the public description. Missing records, unsupported pagination, duplicate IDs and malformed details fail closed.",
  "verifiedPublicJobCount": 7,
  "verifiedIndiaJobCount": 7,
  modulePath: path.join(currentDir, 'script.js'),
}

export default LUMIQ_CATALOG
