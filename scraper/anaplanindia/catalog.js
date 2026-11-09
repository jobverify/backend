import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ANAPLAN_INDIA_CATALOG = {
  source: 'anaplanindia',
  companyName: 'Anaplan India',
  officialBrandName: 'Anaplan',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.anaplan.com/careers/job-listing/',
  officialCareersLandingUrl: 'https://www.anaplan.com/careers/',
  jobDetailsBaseUrl: 'https://www.anaplan.com/careers/jobs/',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/anaplan/jobs',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/anaplan',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-detail-url-canonicalization+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'anaplan.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.anaplan.com/careers/ is the live first-party Anaplan careers landing page with a Search form handoff to https://www.anaplan.com/careers/job-listing/, that the first-party job-listing page uses the verified Greenhouse job-filter shell with the details route base https://www.anaplan.com/careers/jobs/, and that the public Greenhouse jobs API at https://boards-api.greenhouse.io/v1/boards/anaplan/jobs?content=true currently exposes India roles including Alliances Director - Managed Services Partnerships in Mumbai and Anaplan Model Builder in Gurugram.',
  dryRunFile: 'anaplanindia/jobs.json',
}

export default ANAPLAN_INDIA_CATALOG
