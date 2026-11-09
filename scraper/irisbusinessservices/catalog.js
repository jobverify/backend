import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IRIS_BUSINESS_SERVICES_CATALOG = {
  source: 'irisbusinessservices',
  companyName: 'IRIS Business Services',
  officialBrandName: 'IRIS RegTech Solutions Limited (formerly known as IRIS Business Services Limited)',
  adapter: 'script',
  homepageUrl: 'https://irisbusiness.com/',
  companyCareerPage: 'https://irisregtech.com/about-us/careers/current-openings/',
  companyDomain: 'irisregtech.com',
  kekaBoardUrl: 'https://irsl.keka.com/careers/',
  kekaIdentifier: '01edd099-97eb-4b24-a38b-4f0d22b0e27f',
  atsPlatform: 'keka',
  countryFilter: 'India',
  paginationStrategy: 'first-party-embedded-keka-active-feed',
  extractionStrategy: 'verified-first-party-keka-handoff+tenant-identity+active-feed+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the current first-party openings page at https://irisregtech.com/about-us/careers/current-openings/ embeds the official irsl.keka.com career portal. Its active feed exposed 38 postings: 36 with confirmed India locations and two without geography. The scraper returns the confirmed India roles and marks the source listing incomplete while unknown geography remains.',
  dryRunFile: 'irisbusinessservices/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default IRIS_BUSINESS_SERVICES_CATALOG
