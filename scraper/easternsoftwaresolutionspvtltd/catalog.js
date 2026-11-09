import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG = {
  source: 'easternsoftwaresolutionspvtltd',
  companyName: 'Eastern Software Solutions Pvt. Ltd',
  officialBrandName: 'Eastern Software Solutions Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.essindia.com/',
  companyCareerPage: 'https://www.essindia.com/careers.php',
  companyDomain: 'essindia.com',
  atsPlatform: 'official-company-site-job-list',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-job-list-links+same-domain-apply-route',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.essindia.com/careers.php was the live first-party careers page for Eastern Software Solutions Pvt. Ltd., that it displayed the Find Your Next Job section with a public Sales Executive listing, and that the listing linked to the same-domain apply route https://www.essindia.com/apply-now.php?post_name=Sales%20Executive.',
  dryRunFile: 'easternsoftwaresolutionspvtltd/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG
