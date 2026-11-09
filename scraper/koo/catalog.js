import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KOO_CATALOG = {
  source: 'koo',
  companyName: 'Koo',
  officialBrandName: 'Koo',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'koo/jobs.json',
  companyCareerPage: 'https://www.kooapp.com/',
  homepageUrl: 'https://www.kooapp.com/',
  alternateHomepageUrl: 'https://kooapp.com/',
  verifiedBrokenRouteUrls: [
    'https://www.kooapp.com/careers',
    'https://www.kooapp.com/jobs',
    'https://www.kooapp.com/about-us',
    'https://www.kooapp.com/contact-us',
    'https://www.kooapp.com/robots.txt',
    'https://www.kooapp.com/sitemap.xml',
  ],
  companyDomain: 'kooapp.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-broken-first-party-domain-validation',
  extractionStrategy: 'verified-broken-first-party-domain+common-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that both https://www.kooapp.com/ and https://kooapp.com/ returned Wix broken-domain error pages instead of a live first-party company site, and that adjacent first-party routes including https://www.kooapp.com/careers, https://www.kooapp.com/jobs, https://www.kooapp.com/about-us, https://www.kooapp.com/contact-us, https://www.kooapp.com/robots.txt, and https://www.kooapp.com/sitemap.xml returned Wix-branded 404 responses. There is no trustworthy public jobs surface to scrape on the official Koo domain, so this provider fails closed and returns an empty result set.',
}

export default KOO_CATALOG
