import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the live public Ford India jobs surface is the India-filtered ' +
  'Ford careers search at https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750' +
  '&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D, which displayed "23 Results found" ' +
  'with Country: India and Chennai, India locations on the verified date. The same public TalentBrew ' +
  'contract continues to use the resultspost endpoint at https://www.careers.ford.com/search-jobs/resultspost ' +
  'for India listings, with a visible sample title of "Vehicle Technical Illustration Engineer".'

export const FORD_INDIA_CATALOG = {
  source: 'fordindia',
  companyName: 'Ford India',
  officialBrandName: 'Ford Motor Pvt Ltd',
  adapter: 'script',
  dryRunFile: 'fordindia/jobs.json',
  companyCareerPage:
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  officialCareersLandingUrl:
    'https://www.careers.ford.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  resultsPostUrl: 'https://www.careers.ford.com/search-jobs/resultspost',
  indiaFacetId: '1269750',
  verifiedIndiaResultCount: 23,
  verifiedSampleJobTitle: 'Vehicle Technical Illustration Engineer',
  atsPlatform: 'talentbrew-radancy',
  countryFilter: 'India',
  paginationStrategy: 'resultspost-page-form',
  extractionStrategy:
    'verified-india-filtered-ford-careers-page+public-resultspost-json-html-fragments+detail-jsonld',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'careers.ford.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default FORD_INDIA_CATALOG
