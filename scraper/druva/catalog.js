import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DRUVA_CATALOG = {
  source: 'druva',
  companyName: 'Druva',
  officialBrandName: 'Druva',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  officialHomepageUrl: 'https://www.druva.com/',
  careersRedirectUrl: 'https://www.druva.com/careers',
  companyCareerPage: 'https://www.druva.com/why-druva/explore/careers',
  jobDetailsBaseUrl: 'https://www.druva.com/why-druva/explore/careers/jobs/',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/druva/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-shell+embedded-greenhouse-jobs-api+first-party-detail-urls+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'druva.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.druva.com/ is the live first-party Druva homepage, that https://www.druva.com/careers redirects to the live careers shell at https://www.druva.com/why-druva/explore/careers, and that the careers page embeds the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/druva/jobs?content=true plus first-party job routes under https://www.druva.com/why-druva/explore/careers/jobs/. The public Greenhouse feed returned 26 total jobs and 11 India jobs, including https://www.druva.com/why-druva/explore/careers/jobs/8298455002/?gh_jid=8298455002 for MSP Billing & Reporting Specialist in Pune, Maharashtra, India.',
  dryRunFile: 'druva/jobs.json',
}

export default DRUVA_CATALOG
