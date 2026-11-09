import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAPITAL_NUMBERS_INFOTECH_CATALOG = {
  source: 'capitalnumbersinfotech',
  companyName: 'Capital Numbers Infotech',
  officialBrandName: 'Capital Numbers',
  adapter: 'script',
  homepageUrl: 'https://www.capitalnumbers.com/',
  companyCareerPage: 'https://www.capitalnumbers.com/careers.php',
  contactEmail: 'jobs@capitalnumbers.com',
  companyDomain: 'capitalnumbers.com',
  atsPlatform: "official-first-party-careers",
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    "complete-public-role-cards+email-apply",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: "2026-09-13",
  verifiedSurfaceSummary:
    "Verified September 13, 2026: the official Capital Numbers careers page publishes four current role cards. Every advertised card and identifier is validated, and only verified India locations are included.",
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'capitalnumbersinfotech/jobs.json',
}

export default CAPITAL_NUMBERS_INFOTECH_CATALOG
