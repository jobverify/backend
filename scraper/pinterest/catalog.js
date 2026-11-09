import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PINTEREST_CATALOG = {
  source: 'pinterest',
  companyName: 'Pinterest',
  officialBrandName: 'Pinterest',
  adapter: 'script',
  companyCareerPage: 'https://www.pinterestcareers.com/jobs/',
  officialCareersPageUrl: 'https://www.pinterestcareers.com/jobs/',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/pinterest/jobs?content=true',
  officialJobUrlPrefix: 'https://www.pinterestcareers.com/jobs/?gh_jid=',
  companyDomain: 'pinterestcareers.com',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-domain+public-greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that the official Pinterest jobs surface remains the first-party domain https://www.pinterestcareers.com/jobs/, that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/pinterest/jobs?content=true still returns first-party apply URLs on that domain, and that the live payload now returns 218 postings but still zero India roles. The first-party careers page currently serves a Cloudflare "Just a moment..." interstitial to unauthenticated fetches, so the scraper validates that interstitial and then uses the verified public Greenhouse payload to return an honest empty India slice.',
  dryRunFile: 'pinterest/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PINTEREST_CATALOG
