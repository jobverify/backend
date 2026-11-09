import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INFIBEAM_AVENUES_CATALOG = {
  source: 'infibeamavenues',
  companyName: 'Infibeam Avenues',
  officialBrandName: 'AvenuesAI Limited (formerly known as Infibeam Avenues Limited)',
  adapter: 'script',
  homepageUrl: 'https://www.avenuesai.com/',
  companyCareerPage: 'https://www.avenuesai.com/career-opportunities',
  companyDomain: 'avenuesai.com',
  atsPlatform: 'official-careers-page-no-public-job-listings',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-career-opportunities-page-without-listings',
  extractionStrategy: 'verified-first-party-careers-page+brand-rename-evidence+no-public-job-links+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.avenuesai.com/career-opportunities was the live first-party career page for AvenuesAI Limited, that the same page described the company as formerly known as Infibeam Avenues Limited, and that it exposed culture and company information but no public role cards, apply links, or structured jobs feed. This exact-name Infibeam Avenues provider therefore fails closed until AvenuesAI publishes a trustworthy public jobs surface.',
  dryRunFile: 'infibeamavenues/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default INFIBEAM_AVENUES_CATALOG
