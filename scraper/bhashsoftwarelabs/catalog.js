import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BHASH_SOFTWARE_LABS_CATALOG = {
  source: 'bhashsoftwarelabs',
  companyName: 'Bhash Software Labs',
  officialBrandName: 'Bhash Softwares',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://bhashsoftware.com/',
  companyCareerPage: 'https://bhashsoftware.com/careers',
  atsPlatform: 'official-homepage-plus-missing-careers-route',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-404-validation-return-empty',
  extractionStrategy: 'verified-homepage+verified-missing-careers-route+no-trustworthy-public-jobs-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'bhashsoftware.com',
  dryRunFile: 'bhashsoftwarelabs/jobs.json',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://bhashsoftware.com/ was the live first-party Bhash Softwares homepage with contact details, while https://bhashsoftware.com/careers returned a branded 404 "Page not found" route instead of a public careers or jobs surface.',
}

export default BHASH_SOFTWARE_LABS_CATALOG
