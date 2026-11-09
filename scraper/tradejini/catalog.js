import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRADE_JINI_CATALOG = {
  source: 'tradejini',
  companyName: 'TradeJini',
  officialBrandName: 'Tradejini Financial Services Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://www.tradejini.com/careers',
  officialCareersPageUrl: 'https://www.tradejini.com/careers',
  officialOpenPositionsUrl: 'https://www.tradejini.com/careers/open-positions',
  companyDomain: 'tradejini.com',
  atsPlatform: 'first-party-careers-shell-no-public-job-records',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-open-positions-route',
  extractionStrategy: 'verified-first-party-careers-page+verified-open-positions-route+return-empty-when-no-public-job-records',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.tradejini.com/careers is the live first-party TradeJini careers shell and that it links directly to https://www.tradejini.com/careers/open-positions. Anonymous verification of the first-party open-positions route showed the same TradeJini careers shell but no public job records, so this provider stays fail-closed and returns an empty result unless that route later begins exposing trustworthy public roles.',
  dryRunFile: 'tradejini/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TRADE_JINI_CATALOG
