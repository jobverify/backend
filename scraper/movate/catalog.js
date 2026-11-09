import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const MOVATE_CATALOG = {
  "source": "movate",
  "companyName": "Movate",
  "adapter": "script",
  "companyCareerPage": "https://www.movate.com/careers-at-movate/",
  "jobsPageUrl": "https://www.movate.com/careers/latest-job-openings/",
  "linkedJobsBoardUrl": "https://movatecareers.movate.com/MovateJobOpenings",
  "companyDomain": "movate.com",
  "atsPlatform": "official-first-party-aspnet-careers",
  "countryFilter": "India",
  "paginationStrategy": "all-dom-cards-client-side-pagination",
  "extractionStrategy": "verified-first-party-careers-page+linked-first-party-aspnet-portal+all-SSR-cards+validated-India-detail-pages",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "verifiedPublicJobCount": 424,
  "verifiedIndiaJobCount": 301,
  "verifiedSurfaceSummary": "Verified on October 3, 2026 that the official Movate careers page links to Latest Job Openings India, which embeds https://movatecareers.movate.com/MovateJobOpenings. The first-party ASP.NET portal exposes all 424 job cards in the initial HTML and paginates them in the browser. A complete live dry-run verified 301 unique India requisitions, each with a matching RRF/title and full description on its first-party job detail page.",
  "dryRunFile": "movate/jobs.json"
  ,"modulePath": path.resolve(currentDir, 'script.js')
}
export default MOVATE_CATALOG
