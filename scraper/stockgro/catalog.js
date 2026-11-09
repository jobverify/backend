import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STOCKGRO_CATALOG = {
  source: 'stockgro',
  companyName: 'StockGro',
  officialBrandName: 'StockGro',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'stockgro/jobs.json',
  homepageUrl: 'https://www.stockgro.club/',
  companyCareerPage: 'https://www.stockgro.club/careers/',
  officialOperatingEntity: 'Assetgro Fintech Private Limited',
  companyDomain: 'stockgro.club',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-without-public-job-links-or-ats-handoff',
  extractionStrategy:
    'verified-first-party-careers-page+static-openings-copy-without-trustworthy-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.stockgro.club/careers/ is the live first-party exact-name StockGro careers page, that it still contains the static copy "Explore our current job openings and join us!", and that the page identifies Assetgro Fintech Private Limited on the same first-party surface. There is no trustworthy public jobs surface on the live first-party HTML as of July 17, 2026: no trustworthy public job listing URLs, ATS handoff, or machine-readable job postings were exposed. This provider is therefore pinned as a fail-closed sentinel that returns no jobs until StockGro publishes a trustworthy first-party public jobs surface.',
}

export default STOCKGRO_CATALOG
