import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INNOPLEXUS_CATALOG = {
  source: 'innoplexus',
  companyName: 'Innoplexus',
  officialBrandName: 'Partex.AI',
  adapter: 'script',
  homepageUrl: 'https://www.innoplexus.com/',
  companyCareerPage: 'https://www.innoplexus.com/careers',
  redirectedCareersPageUrl: 'https://partex.ai/en/careers',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-embedded-job-array',
  extractionStrategy: 'innoplexus-careers-redirect+embedded-open-positions-array',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'innoplexus.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.innoplexus.com/careers redirected to the live first-party careers page at https://partex.ai/en/careers and that the page exposed an embedded public openings array with India roles including AVP/VP/Sr. VP. - Business Development, Associate Scientific Manager - Life Sciences, AI Engineer, and Account Manager.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'innoplexus/jobs.json',
}

export default INNOPLEXUS_CATALOG
