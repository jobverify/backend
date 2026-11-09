import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const QBSS_CATALOG = {
  source: 'qbss',
  companyName: 'Qbss',
  officialBrandName: 'ContinuServe',
  adapter: 'script',
  companyCareerPage: 'https://continuserve.com/careers/',
  legacyCareerPage: 'https://www.quatrrobss.com/careers/',
  workingAtUrl: 'https://www.quatrrobss.com/working-at-quatrro/',
  companyDomain: 'continuserve.com',
  atsPlatform: 'verified-rebrand-continuserve-careers-wordpress',
  countryFilter: 'India',
  paginationStrategy: 'single-continuserve-listing-page-plus-detail-pages',
  extractionStrategy:
    'verified-qbss-legacy-redirects+continuserve-detail-links+india-internal-detail-table-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedPublicJobCount: 17,
  verifiedIndiaJobCount: 6,
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that the legacy QBSS routes https://www.quatrrobss.com/careers/ and https://www.quatrrobss.com/working-at-quatrro/ still point candidates to the live ContinuServe careers surface at https://continuserve.com/careers/, where the rendered listing exposed 17 public detail pages and 6 India roles of type "Jobs at ContinuServe". This scraper validates the ContinuServe careers surface and returns only India internal roles whose detail tables still match that verified contract.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default QBSS_CATALOG
