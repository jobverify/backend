import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FRONTROW_CATALOG = {
  source: 'frontrow',
  companyName: 'FrontRow',
  officialBrandName: 'FrontRow',
  adapter: 'script',
  homepageUrl: 'https://frontrow.co.in/',
  companyCareerPage: 'https://frontrow.co.in/',
  shutdownUpdateUrl: 'https://medium.com/@frontrowblog/frontrow-update-6ac848595ed2',
  companyDomain: 'frontrow.co.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-shutdown-redirect-plus-verified-update-article',
  extractionStrategy: 'verified-homepage-redirect-to-official-shutdown-update-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that both https://frontrow.co.in/ and https://medium.com/@frontrowblog/frontrow-update-6ac848595ed2 currently resolve to the same HTTP 403 Cloudflare block on medium.com at the official FrontRow shutdown-update URL. The trusted shutdown notice is no longer readable from this environment, but the exact-name homepage still hands off only to that blocked Medium update and no trustworthy public jobs surface was discoverable on the verified date.',
  dryRunFile: 'frontrow/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FRONTROW_CATALOG
