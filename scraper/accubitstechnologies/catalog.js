import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ACCUBITS_TECHNOLOGIES_CATALOG = {
  source: 'accubitstechnologies',
  companyName: 'Accubits Technologies',
  officialBrandName: 'Accubits',
  adapter: 'script',
  companyCareerPage: 'https://accubits.com/career/',
  officialCareersPageUrl: 'https://accubits.com/career/',
  companyDomain: 'accubits.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-careers-shell+search-controls-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://accubits.com/career/ is the live first-party Accubits careers shell and that it currently exposes View Job Openings and Latest Jobs search controls plus an application form, but no trustworthy public jobs surface with visible role rows, detail links, or machine-readable listings was exposed in the verified crawl.',
  dryRunFile: 'accubitstechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ACCUBITS_TECHNOLOGIES_CATALOG
