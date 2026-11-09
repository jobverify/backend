import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LAMINAAR_AVIATION_INFOTECH_CATALOG = {
  source: 'laminaaraviationinfotech',
  companyName: 'Laminaar Aviation Infotech',
  officialBrandName: 'Laminaar Aviation Infotech (India) Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.laminaar.in/',
  companyCareerPage: 'https://www.laminaar.in/careers',
  atsPlatform: 'no-public-careers-route-on-first-party-site',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy: 'verified-homepage-spa-shell+careers-route-homepage-fallback+no-public-jobs-signal',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'laminaar.in',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.laminaar.in/ serves only a generic first-party SPA shell titled "Laminaar Aviation Infotech (India) Pvt. Ltd." and that the public /careers route falls back to the same shell without exposing careers, jobs, or join-us markers. Because no trustworthy first-party public openings surface is available, this provider fails closed and returns no jobs.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default LAMINAAR_AVIATION_INFOTECH_CATALOG
