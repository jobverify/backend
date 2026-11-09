import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MITRATECH_CATALOG = {
  source: 'mitratech',
  companyName: 'Mitratech',
  officialBrandName: 'Mitratech',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://mitratech.com/',
  companyCareerPage: 'https://mitratech.com/about-us/careers/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/mitratech',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/mitratech/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'greenhouse-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+greenhouse-board-handoff+greenhouse-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mitratech.com',
  dryRunFile: 'mitratech/jobs.json',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://mitratech.com/about-us/careers/ is the live official Mitratech careers page, that it links candidates to the official public Greenhouse board at https://job-boards.greenhouse.io/mitratech, and that the Greenhouse jobs feed at https://boards-api.greenhouse.io/v1/boards/mitratech/jobs?content=true exposes India roles including Principal Data Engineer and Senior Product Designer on the verified date.',
}

export default MITRATECH_CATALOG
