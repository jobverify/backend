import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "aranca",
  "companyName": "Aranca",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-paginated-jobs-board",
  "countryFilter": "India",
  "paginationStrategy": "verified-pagination-links",
  "extractionStrategy": "verified-first-party-careers-handoff+paginated-board+india-detail-pages",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "companyCareerPage": "https://www.aranca.com/careers.php",
  "companyDomain": "aranca.com",
  "officialJobsBoardUrl": "https://www2.aranca.com/careers/",
  "detailUrlPattern": "https://www2.aranca.com/careers/jobdetails/job/{numeric_id}",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 17,
  "verifiedIndiaJobCount": 16,
  "verificationDisposition": "verified-public-paginated-jobs-board",
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://www.aranca.com/careers.php was the live first-party Aranca careers page, that its public calls to action Explore Open Positions and Current Openings both handed candidates to the public jobs board at https://www2.aranca.com/careers/, and that the paginated board publicly exposed 17 current openings including 16 India-located roles across Mumbai and Gurgaon plus a separate California sales role. This scraper validates the verified first-party handoff, walks the public pagination links, and returns the current India jobs from the visible Aranca detail pages such as Senior Analyst - Private Credit and Senior Consultant/Assistant Manager - Financial Modeling.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-paginated-jobs-board",
  "originalModulePath": "../workbookbatch02/aranca.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\aranca.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
