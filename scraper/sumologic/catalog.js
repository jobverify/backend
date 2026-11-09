import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SUMO_LOGIC_CATALOG = {
  source: 'sumologic',
  companyName: 'Sumo Logic',
  officialBrandName: 'Sumo Logic',
  adapter: 'script',
  homepageUrl: 'https://www.sumologic.com/',
  companyCareerPage: 'https://www.sumologic.com/company/careers',
  careersMarkdownUrl: 'https://www.sumologic.com/company/careers.md',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/sumologic',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/sumologic/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-greenhouse-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-careers-markdown+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sumologic.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sumologic.com/company/careers and https://www.sumologic.com/company/careers.md were the live first-party Sumo Logic careers surfaces, that they handed off to the public Greenhouse board at https://job-boards.greenhouse.io/sumologic, and that the public jobs API at https://boards-api.greenhouse.io/v1/boards/sumologic/jobs?content=true exposed current India roles including Noida, Uttar Pradesh, India and Bengaluru, Karnataka, India.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SUMO_LOGIC_CATALOG
