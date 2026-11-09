import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENTRUST_SOFTWARE_SERVICES_CATALOG = {
  source: 'entrustsoftwareservices',
  companyName: 'eNTrust Software & Services',
  adapter: 'script',
  homepageUrl: 'https://www.entrustsoft.in/',
  companyCareerPage: 'https://www.entrustsoft.in/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-without-careers-navigation',
  extractionStrategy: 'verified-first-party-homepage+contact-signals+no-careers-navigation-or-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'entrustsoft.in',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.entrustsoft.in/ was the live first-party eNTrust homepage, that it still exposed company overview and Get in touch contact signals, and that it exposed no careers navigation, public openings index, or first-party role detail pages.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'entrustsoftwareservices/jobs.json',
}

export default ENTRUST_SOFTWARE_SERVICES_CATALOG
