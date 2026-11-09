import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const QUBOLE_INDIA_CATALOG = {
  source: 'quboleindia',
  companyName: 'Qubole India',
  officialBrandName: 'Qubole',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'quboleindia/jobs.json',
  homepageUrl: 'https://www.qubole.com/',
  companyCareerPage: 'https://www.qubole.com/company/careers',
  verifiedOpenPositionsUrl: 'https://www.qubole.com/company/careers',
  companyDomain: 'qubole.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-self-looping-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+self-looping-open-positions-cta+no-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.qubole.com/company/careers is the live exact-name first-party Qubole careers page for Qubole India and that its visible View Open Positions CTA loops back to the same careers URL instead of handing off to a public ATS, listing feed, or public job detail surface. Because the official page exposes no trustworthy public jobs surface, this exact-name provider is a fail-closed sentinel that returns no jobs until first-party structured listings are published.',
}

export default QUBOLE_INDIA_CATALOG
