import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MONEYVIEW_CATALOG = {
  source: 'moneyview',
  companyName: 'Moneyview',
  officialBrandName: 'Moneyview',
  adapter: 'script',
  companyCareerPage: 'https://moneyview.in/careers',
  companyDomain: 'moneyview.in',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'official-careers-page+darwinbox-candidate-handoff+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://moneyview.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://moneyview.darwinbox.in',
  darwinboxCompanyId: 'main',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://moneyview.in/careers is the live first-party Moneyview careers page, that it describes "Open positions at Moneyview" and directs applicants to career@moneyview.in, and that it explicitly links job seekers to the official Darwinbox candidate handoff at https://moneyview.darwinbox.in/ms/candidate/careers, which resolves to the public Moneyview Darwinbox candidate shell.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MONEYVIEW_CATALOG
