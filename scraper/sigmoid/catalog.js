import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIGMOID_CATALOG = {
  source: 'sigmoid',
  companyName: 'Sigmoid',
  officialBrandName: 'Sigmoid',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sigmoid/jobs.json',
  officialHomepageUrl: 'https://www.sigmoid.com/',
  companyCareerPage: 'https://www.sigmoid.com/careers/',
  officialCurrentOpeningsUrl: 'https://www.sigmoid.com/careers/current-openings/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/sigmoid',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/sigmoid/jobs?content=true',
  companyDomain: 'sigmoid.com',
  verifiedPublicRoleCount: 44,
  verifiedIndiaRoleCount: 39,
  verifiedSampleJobTitle: 'Assistant Manager - Business Insight & Analytics',
  verifiedSampleSecondaryJobTitle: 'Associate Director - Corporate Finance / FP&A',
  verifiedSampleJobUrl: 'https://job-boards.greenhouse.io/sigmoid/jobs/8456380002',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+verified-current-openings-page+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on Sunday, July 19, 2026 that https://www.sigmoid.com/careers/ is the live exact-name Sigmoid careers page, that it hands candidates to the first-party current openings page at https://www.sigmoid.com/careers/current-openings/, and that the verified current openings page embeds and links the live Greenhouse board via https://job-boards.greenhouse.io/sigmoid and https://boards-api.greenhouse.io/v1/boards/sigmoid/jobs?content=true. Verified that the Greenhouse payload exposed 44 public roles including 39 India roles on the verified date, with sample openings including Assistant Manager - Business Insight & Analytics and Associate Director - Corporate Finance / FP&A.',
}

export default SIGMOID_CATALOG
