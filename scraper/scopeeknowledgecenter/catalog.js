import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCOPE_EKNOWLEDGE_CENTER_CATALOG = {
  source: 'scopeeknowledgecenter',
  companyName: 'Scope eKnowledge Center',
  officialBrandName: 'Scope e-Knowledge Center',
  adapter: 'script',
  homepageUrl: 'https://www.scopeknowledge.com/',
  companyCareerPage: 'https://www.scopeknowledge.com/',
  atsPlatform: 'exact-name-domain-blocked-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-homepage-plus-common-careers-route-validation',
  extractionStrategy:
    'verified-exact-name-domain-blocked+verified-common-careers-routes-blocked+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'scopeknowledge.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the exact-name domain https://www.scopeknowledge.com/ and common first-party recruiting routes such as /careers, /jobs, /join-us, and /contact-us all returned 403 blocked responses in direct checks. No trustworthy public jobs inventory was enumerable from the exact-name Scope eKnowledge Center domain on the verified date, so this provider stays fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'scopeeknowledgecenter/jobs.json',
}

export default SCOPE_EKNOWLEDGE_CENTER_CATALOG
