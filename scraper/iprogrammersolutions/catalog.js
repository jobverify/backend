import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IPROGRAMMER_SOLUTIONS_CATALOG = {
  "source": "iprogrammersolutions",
  "companyName": "Iprogrammer Solutions",
  "officialBrandName": "iProgrammer Solutions",
  "homepageUrl": "https://iprogrammer.com/",
  "companyCareerPage": "https://iprogrammer.com/current-openings-pune/",
  "companyDomain": "iprogrammer.com",
  "atsPlatform": "official-first-party-job-listing-page",
  "paginationStrategy": "single-first-party-openings-page",
  "extractionStrategy": "job-card-listing-with-detail-links",
  "verificationDisposition": "official-careers-route-redirects-to-homepage-no-verified-current-inventory",
  "verifiedSurfaceSummary": "Verified October 3, 2026: current-openings-pune and careers redirect to the redesigned official homepage, whose links and published sitemap do not expose a current careers board. Homepage client code references an official mission-control API, but its four job-openings records use localhost application URLs and prototype copy; those records are not a verified public recruiting feed. The scraper remains fail-closed and no current job count is claimed.",
  "adapter": "script",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "dryRunFile": "iprogrammersolutions/jobs.json",
  modulePath: path.join(currentDir, 'script.js'),
}

export default IPROGRAMMER_SOLUTIONS_CATALOG
