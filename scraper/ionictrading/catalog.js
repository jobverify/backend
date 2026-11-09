import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IONIC_TRADING_CATALOG = {
  source: 'ionictrading',
  companyName: 'Ionic Trading',
  adapter: 'script',
  companyCareerPage: 'https://ionic.trade/',
  homepageUrl: 'https://ionic.trade/',
  documentationUrl: 'https://dev.api.ionic.trade/docs',
  officialBrandName: 'Ionic',
  productTagline: 'Solana Trading Infrastructure',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'Global',
  paginationStrategy: 'verified-homepage-plus-adjacent-route-validation',
  extractionStrategy:
    'verified-first-party-homepage-without-linked-public-careers+adjacent-routes-non-jobs-or-all-routes-unreachable-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ionic.trade',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that live HTTP probes from this environment to https://ionic.trade/ and the adjacent first-party routes https://ionic.trade/about, https://ionic.trade/careers, https://ionic.trade/jobs, and https://ionic.trade/contact now time out before any trustworthy careers surface can be reached. The trusted first-party Ionic marketing surface had recently exposed only product and documentation navigation without any public jobs listings, and no alternate official careers surface was discoverable on the verified date. The scraper therefore returns an authoritative empty result when those verified first-party routes are all unreachable or otherwise remain non-jobs surfaces.',
  adjacentRouteUrls: [
    'https://ionic.trade/about',
    'https://ionic.trade/careers',
    'https://ionic.trade/jobs',
    'https://ionic.trade/contact',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default IONIC_TRADING_CATALOG
