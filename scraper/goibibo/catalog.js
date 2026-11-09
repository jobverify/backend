import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GOIBIBO_CATALOG = {
  source: 'goibibo',
  companyName: 'Goibibo',
  companyCareerPage: 'https://www.goibibo.com/careers/',
  companyDomain: 'goibibo.com',
  adapter: 'script',
  atsPlatform: 'official-company-careers-unavailable',
  countryFilter: 'India',
  paginationStrategy: 'homepage-careers-link-validation',
  extractionStrategy: 'verified-homepage+broken-careers-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: path.join(currentDir, 'script.js'),
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that the official Goibibo homepage still links job seekers to https://www.goibibo.com/careers/, but that first-party route currently resolves only to an unavailable surface from this environment, observed as 404/503/504-style failures or request timeouts rather than a trustworthy public jobs listing page.',
  homepageUrl: 'https://www.goibibo.com/',
  acceptedCareerPageStatuses: [404, 503, 504],
}

export default GOIBIBO_CATALOG
