import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COCKROACHDB_CATALOG = {
  source: 'cockroachdb',
  companyName: 'CockroachDB',
  officialBrandName: 'Cockroach Labs',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cockroachdb/jobs.json',
  officialCareersLandingUrl: 'https://www.cockroachlabs.com/careers/',
  companyCareerPage: 'https://www.cockroachlabs.com/careers/open-positions/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/cockroachlabs',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/cockroachlabs/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-pages+verified-greenhouse-ats-handoff+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cockroachlabs.com',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.cockroachlabs.com/careers/ is the live first-party Cockroach Labs careers landing page, that https://www.cockroachlabs.com/careers/open-positions/ is the live first-party open-positions page, and that Cockroach Labs\' first-party interview guide explicitly states candidates receive ATS messages from the Applicant Tracking System (in this case, Greenhouse). The public jobs surface resolves through the official Greenhouse board at https://job-boards.greenhouse.io/cockroachlabs and the structured feed at https://boards-api.greenhouse.io/v1/boards/cockroachlabs/jobs?content=true. Verified public India roles on the date included Manager, Engineering and Senior Partner Sales Manager, ISV & GSIs in Bangalore, India.',
}

export default COCKROACHDB_CATALOG
