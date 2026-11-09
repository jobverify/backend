import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMARTSTREAM_TECHNOLOGIES_CATALOG = {
  source: 'smartstreamtechnologies',
  companyName: 'SmartStream Technologies',
  officialBrandName: 'Smartstream',
  adapter: 'script',
  homepageUrl: 'https://smart.stream/',
  companyCareerPage: 'https://smart.stream/careers/',
  atsPlatform: 'official-company-site-cloudflare-blocked-no-public-jobs-catalog',
  countryFilter: 'India',
  paginationStrategy: 'verified-cloudflare-blocked-homepage-and-careers-routes',
  extractionStrategy: 'verified-cloudflare-blocked-homepage+verified-cloudflare-blocked-careers-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'smart.stream',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that both https://smart.stream/ and https://smart.stream/careers/ currently return the same Cloudflare-backed HTTP 403 Forbidden shell with the title "Error 403 Forbidden" and no public job cards, detail links, ATS handoff, or structured jobs payload. Search snippets still reference older careers copy, but without a reachable first-party careers surface or trustworthy public jobs contract there is no enumerable public Smartstream jobs feed to scrape today.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SMARTSTREAM_TECHNOLOGIES_CATALOG
