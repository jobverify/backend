import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that the first-party Marolix Technology Solutions routes https://www.marolix.com/, https://www.marolix.com/contact-us, and https://www.marolix.com/careers returned the branded Cloudflare origin-outage surfaces for marolix.com, including 522 Connection timed out and 523 Origin is unreachable responses. No trustworthy public jobs surface was accessible on the verified date, so this provider stays fail-closed until the first-party site returns with a verifiable public careers surface.'

export const MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG = {
  source: 'marolixtechnologysolutions',
  companyName: 'Marolix Technology Solutions',
  officialBrandName: 'Marolix Technology Solutions Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://www.marolix.com/',
  companyCareerPage: 'https://www.marolix.com/careers',
  contactPageUrl: 'https://www.marolix.com/contact-us',
  companyDomain: 'marolix.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-plus-common-careers-route-validation',
  extractionStrategy: 'verified-homepage-or-cloudflare-origin-outage+verified-contact-or-cloudflare-origin-outage+verified-missing-careers-route-or-cloudflare-origin-outage-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'marolixtechnologysolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG
