import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SUCCESSIVE_TECHNOLOGIES_CATALOG = {
  source: 'successivetechnologies',
  companyName: 'Successive Technologies',
  officialBrandName: 'Successive Technologies Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://successive.tech/',
  companyCareerPage: 'https://successive.tech/careers/jobsearch/',
  jobsBoardUrl: 'https://successivesoftware.keka.com/careers/',
  atsPlatform: 'official-careers-page-plus-keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'single-keka-active-jobs-endpoint',
  extractionStrategy: 'verified-first-party-careers-page+embedded-keka-config+careerportalinfo+active-keka-embed-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'successive.tech',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://successive.tech/careers/jobsearch/ was the live first-party Successive Technologies careers page, that it embedded the public Keka domain https://successivesoftware.keka.com/careers/ with identifier a0dbae8a-c880-42dd-8947-466574e4de7d, and that the verified Keka public contract currently resolved to the exact company identity but an empty public active jobs feed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SUCCESSIVE_TECHNOLOGIES_CATALOG
