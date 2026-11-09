import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FANCLASH_CATALOG = {
  source: 'fanclash',
  companyName: 'Fanclash',
  officialBrandName: 'FanClash',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'fanclash/jobs.json',
  homepageUrl: 'https://fanclash.com/',
  companyCareerPage: 'https://fanclash.com/',
  parkedHomepageUrls: [
    'https://fanclash.com/',
    'https://www.fanclash.com/',
  ],
  checked404RouteUrls: [
    'https://fanclash.com/careers',
    'https://www.fanclash.com/careers',
    'https://fanclash.com/jobs',
    'https://www.fanclash.com/jobs',
    'https://fanclash.com/robots.txt',
    'https://www.fanclash.com/robots.txt',
    'https://fanclash.com/sitemap.xml',
    'https://www.fanclash.com/sitemap.xml',
  ],
  unresolvedFirstPartyUrls: [
    'https://fanclash.in/',
    'https://www.fanclash.in/',
    'https://fanclash.in/careers',
    'https://www.fanclash.in/careers',
  ],
  parkedDomainRedirectUrl: 'https://www.atom.com/name/FanClash',
  companyDomain: 'fanclash.com',
  atsPlatform: 'official-company-site-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'parked-domain-plus-missing-routes-plus-unresolved-host-validation',
  extractionStrategy:
    'verified-parked-first-party-domain+verified-404-careers-jobs-crawl-routes+verified-unresolved-alternate-first-party-hosts-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://fanclash.com/ and https://www.fanclash.com/ no longer serve a live Fanclash company site and instead redirect to the parked Atom listing at https://www.atom.com/name/FanClash. Verified that https://fanclash.com/careers, https://www.fanclash.com/careers, https://fanclash.com/jobs, https://www.fanclash.com/jobs, https://fanclash.com/robots.txt, https://www.fanclash.com/robots.txt, https://fanclash.com/sitemap.xml, and https://www.fanclash.com/sitemap.xml all return first-party 404 "Page not found." responses. Also verified that https://fanclash.in/, https://www.fanclash.in/, https://fanclash.in/careers, and https://www.fanclash.in/careers fail DNS resolution. There is no trustworthy public jobs surface for exact-name Fanclash on the verified date.',
}

export default FANCLASH_CATALOG
