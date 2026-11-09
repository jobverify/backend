import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MCKINSEY_COMPANY_CATALOG = {
  source: 'mckinseycompany',
  companyName: 'McKinsey & Company',
  officialBrandName: 'McKinsey & Company',
  adapter: 'script',
  homepageUrl: 'https://www.mckinsey.com/',
  companyCareerPage: 'https://www.mckinsey.com/in/careers-in-india',
  officialGlobalCareersUrl: 'https://www.mckinsey.com/careers/',
  publicJobsSearchUrl: 'https://www.mckinsey.com/careers/search-jobs/en',
  publicSearchApiUrl: 'https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search',
  searchPageSize: 20,
  companyDomain: 'mckinsey.com',
  atsPlatform: 'mckinsey-careers-api',
  countryFilter: 'India',
  paginationStrategy: 'public-search-api-start-offset-pagination-until-empty-page',
  extractionStrategy: 'verified-india-careers-page+public-search-api+india-location-pair-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.mckinsey.com/in/careers-in-india is the live India careers handoff for McKinsey & Company, https://www.mckinsey.com/careers/search-jobs/en is the live public search page, and https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search is the public jobs API behind that page. The verified public surface returned an India-eligible Business Analyst Intern opening via the API.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MCKINSEY_COMPANY_CATALOG
