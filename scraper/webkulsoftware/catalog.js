import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const WEBKUL_SOFTWARE_CATALOG = {
  source: 'webkulsoftware',
  companyName: 'Webkul Software',
  officialBrandName: 'Webkul Software',
  adapter: 'script',
  companyCareerPage: 'https://webkul.com/jobs/',
  careersLandingUrl: 'https://webkul.com/careers/',
  jobsPageUrl: 'https://webkul.com/jobs/',
  companyDomain: 'webkul.com',
  atsPlatform: 'official-company-site-jobs-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-page-html',
  extractionStrategy: 'verified-first-party-jobs-page+detail-pages+inline-open-position-cards-or-current-empty-shell',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that https://webkul.com/jobs/ remains the live first-party Webkul Software jobs surface, but its current HTML now renders only the Open Positions shell with category tabs, LinkedIn follow messaging, and the fallback resume prompt instead of enumerable public job cards. The previously verified detail-page contract on webkul.com still looks trustworthy when specific role URLs are known, but the listing page no longer exposes a trustworthy public jobs inventory, so this provider now returns an honest empty result until public cards reappear on the first-party shell.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'webkulsoftware/jobs.json',
}

export default WEBKUL_SOFTWARE_CATALOG
