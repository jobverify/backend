import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BACANCY_TECHNOLOGY_CATALOG = {
  source: 'bacancytechnology',
  companyName: 'Bacancy Technology',
  officialBrandName: 'Bacancy',
  adapter: 'script',
  companyCareerPage: 'https://www.bacancytechnology.com/careers',
  companyDomain: 'bacancytechnology.com',
  jobsPageUrl: 'https://www.bacancytechnology.com/jobs/careers-apply.php',
  atsPlatform: 'official-company-careers-blocked-by-cloudflare',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-cloudflare-block-validation',
  extractionStrategy: 'verified-careers-page+verified-jobs-page-listing+live-403-cloudflare-block+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that Bacancy used the first-party careers page at https://www.bacancytechnology.com/careers and the first-party jobs page at https://www.bacancytechnology.com/jobs/careers-apply.php, but runtime-style direct fetches to the jobs page returned HTTP 403 with a Cloudflare block page even though browser-rendered verification still exposed public openings. This local provider stays fail-closed until a trustworthy fetchable public jobs surface is available.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default BACANCY_TECHNOLOGY_CATALOG
