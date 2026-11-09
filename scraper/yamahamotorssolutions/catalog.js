import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const YAMAHA_MOTORS_SOLUTIONS_CATALOG = {
  source: 'yamahamotorssolutions',
  companyName: 'Yamaha Motors Solutions',
  officialBrandName: 'Yamaha Motor Solutions (India) Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://careers.ymsl.in/ymsl/',
  companyDomain: 'careers.ymsl.in',
  searchApiUrl: 'https://public.zwayam.com/manageESQueries/searchJob',
  companyApiId: '15506',
  atsPlatform: 'first-party-careers-page-plus-zwayam-search-api',
  countryFilter: 'India',
  paginationStrategy: 'zwayam-search-api',
  extractionStrategy: 'verified-careers-page+verified-zwayam-search-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.ymsl.in/ymsl/ was the live Yamaha Motor Solutions India careers page, that it surfaced Find Authentic Jobs at Yamaha Motor Solutions plus a View jobs route, and that the public zwayam search endpoint at https://public.zwayam.com/manageESQueries/searchJob returned current company-local openings for company id 15506. Live sample results included React Solution Architect and SAP Cutover Manager in Faridabad, Haryana, India.',
  dryRunFile: 'yamahamotorssolutions/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default YAMAHA_MOTORS_SOLUTIONS_CATALOG
