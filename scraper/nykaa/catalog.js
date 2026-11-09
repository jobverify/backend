import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, October 9, 2026 that https://careers.nykaa.com/ is the live official Nykaa careers board, that its current Skima tenant uses the official careers.nykaa.com canonical and Nykaa-specific assets, and that it explicitly reports no public job postings. The current complete public inventory is 0; the previous 22-job snapshot is historical.'

export const NYKAA_CATALOG = {
  source: 'nykaa',
  companyName: 'Nykaa',
  adapter: 'script',
  companyCareerPage: 'https://careers.nykaa.com/',
  publicBoardUrl: 'https://careers.nykaa.com/',
  sampleJobUrl: null,
  companyDomain: 'nykaa.com',
  atsPlatform: 'skima-hosted-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-official-careers-subdomain-plus-html-pagination',
  extractionStrategy:
    'verified-official-careers-board+html-job-cards+detail-pages+skima-structured-metadata',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedPublicOpeningCount: 0,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'nykaa/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NYKAA_CATALOG
