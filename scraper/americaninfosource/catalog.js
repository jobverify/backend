import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMERICAN_INFO_SOURCE_CATALOG = {
  source: 'americaninfosource',
  companyName: 'American InfoSource',
  officialBrandName: 'American InfoSource',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://americaninfosource.com/',
  companyCareerPage: 'https://americaninfosource.com/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-domain-root-plus-common-careers-route-timeout-validation',
  extractionStrategy: 'verified-exact-name-first-party-domain-without-trustworthy-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'americaninfosource.com',
  dryRunFile: 'americaninfosource/jobs.json',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the exact-name domain https://americaninfosource.com/ was the official first-party host candidate for American InfoSource, but direct probes in this sweep timed out and no trustworthy public careers feed or first-party jobs board was confirmed on that domain or its common careers routes.',
}

export default AMERICAN_INFO_SOURCE_CATALOG
