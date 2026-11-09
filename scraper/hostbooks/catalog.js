import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOSTBOOKS_CATALOG = {
  source: 'hostbooks',
  companyName: 'HostBooks',
  officialBrandName: 'HostBooks',
  adapter: 'script',
  homepageUrl: 'https://www.hostbooks.com/',
  companyCareerPage: 'https://www.hostbooks.com/in/hb/career/',
  companyDomain: 'hostbooks.com',
  atsPlatform: 'official-first-party-current-opening-table',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-current-opening-table+inline-role-sections+shared-resume-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.hostbooks.com/in/hb/career/ is the live first-party HostBooks careers page, that it renders the "Current Opening" table plus inline role-detail sections, and that the verified surface exposes public roles including Java Developer, PHP Developer, Finance Manager, and Channel Sales - Channel Partner Manager with the shared first-party resume submission flow.',
  dryRunFile: 'hostbooks/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HOSTBOOKS_CATALOG
