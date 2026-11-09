import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAHANAGAR_GAS_CATALOG = {
  source: 'mahanagargas',
  companyName: 'Mahanagar Gas',
  officialBrandName: 'Mahanagar Gas Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mahanagargas/jobs.json',
  homepageUrl: 'https://www.mahanagargas.com/',
  companyCareerPage: 'https://www.mahanagargas.com/',
  companyDomain: 'mahanagargas.com',
  atsPlatform: 'official-company-site-no-public-openings',
  countryFilter: 'India',
  paginationStrategy: 'homepage-and-common-careers-route-official-shell-validation',
  extractionStrategy:
    'verified-first-party-shells-no-public-job-signal-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on July 19, 2026 that https://www.mahanagargas.com/ and common careers routes resolve to the reachable first-party Mahanagar Gas Limited shell. The surfaces expose consumer apply content but no trustworthy public jobs surface, ATS handoff, current openings list, or stable public jobs API.',
}

export default MAHANAGAR_GAS_CATALOG
