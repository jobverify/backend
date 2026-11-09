import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TBOTEK_CATALOG = {
  source: 'tbotek',
  companyName: 'TBO Tek',
  officialBrandName: 'TBO.COM',
  companyLegalName: 'TBO Tek Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://www.tbo.com/careers',
  officialCareersPageUrl: 'https://www.tbo.com/careers',
  exactNameEvidenceUrl: 'https://www.tbo.com/terms-and-conditions',
  officialCareersHandoffUrl: 'https://tbo.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://tbo.darwinbox.in',
  darwinboxCompanyId: 'main',
  companyDomain: 'tbo.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+official-darwinbox-handoff+exact-name-legal-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the first-party careers page at https://www.tbo.com/careers exposed an Apply Now handoff to the official Darwinbox candidate portal at https://tbo.darwinbox.in/ms/candidate/careers, and that the first-party legal page at https://www.tbo.com/terms-and-conditions identifies the company as TBO Tek Ltd. This exact-name provider is pinned to that verified first-party careers handoff plus exact-name legal evidence and uses the Darwinbox listing API pattern for India roles only.',
  dryRunFile: 'tbotek/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TBOTEK_CATALOG
