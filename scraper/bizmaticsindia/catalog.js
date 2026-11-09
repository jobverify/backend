import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BIZMATICS_INDIA_CATALOG = {
  source: 'bizmaticsindia',
  companyName: 'Bizmatics India',
  officialBrandName: 'Bizmatics',
  adapter: 'script',
  homepageUrl: 'https://www.bizmatics.com/',
  companyCareerPage: 'https://www.bizmatics.com/company/careers/',
  soldDomainUrl: 'https://www.bizmatics.com/lander',
  companyDomain: 'bizmatics.com',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'homepage-and-careers-shell-redirect-validation',
  extractionStrategy:
    'verified-homepage-shell+verified-careers-shell+verified-domain-sale-lander-or-all-routes-unreachable+no-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that live HTTP probes from this environment to https://www.bizmatics.com/, https://www.bizmatics.com/company/careers/, and the verified /lander route now time out before any trustworthy careers surface can be reached. Those first-party routes had already been verified as a redirect shell leading only to a sold-domain landing experience rather than a live Bizmatics careers site, and no alternate official jobs surface was discoverable on the verified date. The local provider therefore returns an authoritative empty result when all verified first-party routes are unreachable.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'bizmaticsindia/jobs.json',
}

export default BIZMATICS_INDIA_CATALOG
