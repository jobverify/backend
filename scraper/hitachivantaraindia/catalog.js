import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HITACHI_VANTARA_INDIA_CATALOG = {
  source: 'hitachivantaraindia',
  companyName: 'Hitachi Vantara India',
  officialBrandName: 'Hitachi Vantara India',
  officialCompanyLabel: 'HITACHI VANTARA INDIA PRIVATE LIMITED',
  adapter: 'script',
  companyCareerPage: 'https://careers.hitachi.com/jobs?filter%5Bbrand%5D%5B0%5D=Hitachi+Vantara+Global&filter%5Bcountry%5D%5B0%5D=India',
  companyDomain: 'careers.hitachi.com',
  atsPlatform: 'paradox-careersites+workday-handoff',
  countryFilter: 'India',
  paginationStrategy: 'paradox-filtered-jobs-pages-with-legacy-search-fallback',
  extractionStrategy: 'first-party-preload-jobs+exact-legal-entity-and-india-filter+workday-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the retired company search route returns 404. The first-party Paradox jobs page exposes 28 India-located Hitachi Vantara Global roles, of which 22 have the exact HITACHI VANTARA INDIA PRIVATE LIMITED legal entity, with Workday apply URLs.',
  dryRunFile: 'hitachivantaraindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HITACHI_VANTARA_INDIA_CATALOG
