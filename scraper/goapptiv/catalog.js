import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GOAPPTIV_CATALOG = {
  source: 'goapptiv',
  companyName: 'GoApptiv',
  officialBrandName: 'GoApptiv',
  adapter: 'script',
  companyCareerPage: 'https://www.goapptiv.com/',
  companyDomain: 'goapptiv.com',
  teamCulturePageUrl: 'https://www.goapptiv.com/teamandculture',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-team-culture-plus-common-careers-route-validation',
  extractionStrategy:
    'verified-homepage+verified-team-culture+common-careers-routes-return-404-without-public-job-signals',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.goapptiv.com/ and https://www.goapptiv.com/teamandculture are live first-party GoApptiv pages, while https://www.goapptiv.com/careers, /career, /jobs, and /hiring return first-party 404 pages with no trustworthy public job listings or ATS handoffs.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default GOAPPTIV_CATALOG
