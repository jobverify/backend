import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AKERS_BIOSCIENCES_INDIA_CATALOG = {
  source: 'akersbiosciencesindia',
  companyName: 'Akers Biosciences India',
  officialBrandName: 'Akers Biosciences',
  adapter: 'script',
  companyCareerPage: 'https://akersbio.com/',
  companyDomain: 'akersbio.com',
  parkedExactNameUrl: 'https://akersbiosciences.com/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-parked-exact-name-domain-plus-official-host-missing-job-route-validation',
  extractionStrategy:
    'verified-parked-exact-name-domain+official-host-no-public-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on July 19, 2026 that https://akersbiosciences.com/, https://akersbiosciences.com/careers, and https://akersbiosciences.com/jobs serve the same HugeDomains parked-domain page titled "AkersBiosciences.com is for sale | HugeDomains"; https://akersbio.com/ and https://akersbio.com/contact-us serve the official Akers Biosciences public site; https://akersbio.com/sitemap.xml lists product, about, investor, news, and contact pages without careers or jobs URLs; and https://akersbio.com/careers, https://akersbio.com/jobs, and https://akersbio.com/openings return first-party 404 pages. No trustworthy public jobs surface was available for Akers Biosciences India.',
  dryRunFile: 'akersbiosciencesindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AKERS_BIOSCIENCES_INDIA_CATALOG
