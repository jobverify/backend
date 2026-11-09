import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const QUADEYE_CATALOG = {
  source: 'quadeye',
  companyName: 'QuadEye',
  officialBrandName: 'Quadeye',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.quadeye.com/',
  companyCareerPage: 'https://www.quadeye.com/careers/',
  careersPortalUrl: 'https://quadeye.zohorecruit.in/jobs/Careers/',
  careersApiUrl:
    'https://quadeye.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  careersDetailHost: 'career.quadeye.com',
  companyDomain: 'quadeye.com',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-portal-api-inventory-equality',
  extractionStrategy:
    'verified-first-party-careers-page+public-zoho-api+job-location-scope',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'quadeye/jobs.json',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the official careers route redirects to the Jobs | quadeye page at https://www.quadeye.com/jobs, whose canonical metadata now points to quadeye.cyralix.com//jobs. The branded Zoho portal and public API expose matching inventories of 26 roles, including 19 India roles with Gurugram locations. The scraper validates portal/API inventory equality and a live application detail on career.quadeye.com.',
}

export default QUADEYE_CATALOG
