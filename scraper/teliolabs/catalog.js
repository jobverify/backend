import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TELIOLABS_CATALOG = {
  source: 'teliolabs',
  companyName: 'Teliolabs',
  officialBrandName: 'Teliolabs Communications Inc.',
  adapter: 'script',
  homepageUrl: 'https://teliolabs.com/',
  companyCareerPage: 'https://teliolabs.com/job-openings/',
  companyDomain: 'teliolabs.com',
  atsPlatform: 'wp-job-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-archive',
  extractionStrategy: 'verified-first-party-jobs-archive+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://teliolabs.com/job-openings/ is the live first-party Teliolabs jobs archive and that it publicly listed same-domain job cards including Cloud Native Engineer and Junior Perl Developer. Those cards resolve to public detail pages under https://teliolabs.com/career/, confirming a trustworthy first-party wp-job-openings surface for this provider.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default TELIOLABS_CATALOG
