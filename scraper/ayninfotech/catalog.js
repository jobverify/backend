import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AYN_INFOTECH_CATALOG = {
  source: 'ayninfotech',
  companyName: 'AYN InfoTech',
  officialBrandName: 'AYN InfoTech',
  adapter: 'script',
  homepageUrl: 'https://www.ayninfotech.com/',
  companyCareerPage: 'https://www.ayninfotech.com/',
  atsPlatform: 'official-company-site-untrusted-domain',
  countryFilter: 'India',
  paginationStrategy: 'homepage-and-common-career-route-sentinel',
  extractionStrategy: 'verified-untrusted-first-party-domain-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ayninfotech.com',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that the exact first-party domain https://www.ayninfotech.com/ and the common careers routes all redirected outside the company domain to https://www.bigskyworldview.org/ with unrelated Big Sky Worldview Forum content, so the local contract remains a fail-closed sentinel only.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'ayninfotech/jobs.json',
}

export default AYN_INFOTECH_CATALOG
