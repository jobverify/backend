import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENTRUST_SOFTWARE_SERVICES_CATALOG = {
  source: 'entrustsoftwareservices',
  companyName: 'eNTrust Software & Services',
  adapter: 'script',
  homepageUrl: 'https://entrustsoft.in/',
  companyCareerPage: 'https://entrustsoft.in/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-without-careers-navigation',
  extractionStrategy: 'verified-first-party-homepage+contact-signals+no-careers-navigation-or-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'entrustsoft.in',
  verifiedOn: '2026-11-10',
  verifiedSurfaceSummary:
    'Verified November 10, 2026: https://entrustsoft.in/ serves the branded eNTrust Software Services homepage with normally validated HTTPS, the company overview and Get in touch contact signals. The www alias fails certificate hostname validation. The current apex homepage exposes no careers navigation, public openings index, or first-party role detail pages; this does not establish a verified empty recruiting inventory.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'entrustsoftwareservices/jobs.json',
}

export default ENTRUST_SOFTWARE_SERVICES_CATALOG
