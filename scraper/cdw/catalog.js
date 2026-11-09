import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CDW_CATALOG = {
  source: 'cdw',
  companyName: 'CDW',
  officialBrandName: 'CDW',
  adapter: 'script',
  homepageUrl: 'https://www.cdwjobs.com/',
  companyCareerPage: 'https://www.cdwjobs.com/search/jobs',
  companyDomain: 'cdwjobs.com',
  atsPlatform: 'first-party-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'server-rendered-search-results-plus-detail-pages-or-blocked-empty-sentinel',
  extractionStrategy:
    'verified-search-results-page-or-cloudflare-blocked-shell+verified-india-route-or-blocked-india-route+detail-pages-or-empty-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that both https://www.cdwjobs.com/search/jobs and https://www.cdwjobs.com/search/jobs/in/country/india currently return a Cloudflare "Just a moment..." challenge shell with HTTP 403. Because the live first-party search surface and India-filtered route are both blocked, the public India inventory is not trustworthily enumerable on the verified date and this provider returns an empty sentinel until the verified search pages become publicly accessible again.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'cdw/jobs.json',
}

export default CDW_CATALOG
