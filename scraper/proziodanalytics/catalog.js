import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROZIOD_ANALYTICS_CATALOG = {
  source: 'proziodanalytics',
  companyName: 'Proziod Analytics',
  officialBrandName: 'Proziod Analytics',
  adapter: 'script',
  homepageUrl: 'https://proziod.com/',
  companyCareerPage: 'https://careers.proziod.com/',
  companyDomain: 'careers.proziod.com',
  atsPlatform: 'gohire',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-board-page',
  extractionStrategy: 'verified-first-party-gohire-board+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.proziod.com/ is the live first-party Proziod Analytics GoHire board and that it publicly listed 3 open jobs: Design Verification Engineers (DV), Customer Support Specialist, and Team Leader. The first-party job detail pages remained public on the same careers.proziod.com domain, including https://careers.proziod.com/design-verification-engineers-dv-294085/, confirming a trustworthy same-domain public jobs surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default PROZIOD_ANALYTICS_CATALOG
