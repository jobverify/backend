import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified on Saturday, August 15, 2026 that Walmart's official careers surface remained at https://careers.walmart.com/us/en, that the first-party Technology and Corporate pages still route candidates into the live results surface at https://careers.walmart.com/us/en/results, and that the public search endpoint at https://careers.walmart.com/api/ai/search-ai/api/v1/combined/hybrid-search still returned structured Walmart job results for generic role queries. On the same date, an explicit India keyword probe no longer produced the old zero-job India-filter slice, but the returned public hits observed from this environment still did not expose India-located search results, and the publicly reachable historical India detail page https://careers.walmart.com/us/en/jobs/R-2428432 was marked inactive in its public Next.js job data. No trustworthy enumerable first-party active India results feed could be reproduced from Walmart's current public results experience."

export const WALMART_CATALOG = {
  source: 'walmart',
  companyName: 'Walmart',
  officialBrandName: 'Walmart',
  adapter: 'script',
  homepageUrl: 'https://careers.walmart.com/us/en',
  companyCareerPage: 'https://careers.walmart.com/us/en/results',
  officialCareersPageUrl: 'https://careers.walmart.com/us/en/results',
  technologyCareersPageUrl: 'https://careers.walmart.com/us/en/home/careers-areas/technology',
  corporateCareersPageUrl: 'https://careers.walmart.com/us/en/home/careers-areas/corporate',
  searchApiUrl: 'https://careers.walmart.com/api/ai/search-ai/api/v1/combined/hybrid-search',
  companyDomain: 'careers.walmart.com',
  atsPlatform: 'official-first-party-careers-search-page-fail-closed',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-career-area-pages-plus-live-india-query-search-validation',
  extractionStrategy:
    'verified-homepage+verified-technology-and-corporate-pages+verified-live-search-api-india-query-no-located-hits-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  exactCompanyMatchOnly: true,
  verifiedOn: '2026-08-15',
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'walmart/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default WALMART_CATALOG
