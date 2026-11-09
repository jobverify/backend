import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TAILSCALE_CATALOG = {
  source: 'tailscale',
  companyName: 'Tailscale',
  officialBrandName: 'Tailscale',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://tailscale.com/careers',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/tailscale',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/tailscale/jobs',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-single-greenhouse-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+verified-greenhouse-board+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'tailscale.com',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://tailscale.com/careers was the live first-party Tailscale careers page, that its Open positions section handed applicants to the official Greenhouse board at https://job-boards.greenhouse.io/tailscale, and that the public Greenhouse feed at https://boards-api.greenhouse.io/v1/boards/tailscale/jobs?content=true was live. The verified public board showed locations in Canada, the United States, the United Kingdom, and Singapore, with zero India openings on the verified date.',
  dryRunFile: 'tailscale/jobs.json',
}

export default TAILSCALE_CATALOG
