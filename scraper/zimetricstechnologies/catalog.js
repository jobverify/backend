import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ZIMETRICS_TECHNOLOGIES_CATALOG = {
  source: 'zimetricstechnologies',
  companyName: 'Zimetrics Technologies',
  officialBrandName: 'Zimetrics',
  adapter: 'script',
  companyCareerPage: 'https://zimetrics.com/career/',
  atsPlatform: 'official-company-careers-form-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-inline-role-cards',
  extractionStrategy:
    'verified-first-party-careers-page+inline-role-cards+form-anchor-apply-handoff+dedupe-identical-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'zimetrics.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://zimetrics.com/career/ remained the live first-party Zimetrics careers page, that the page exposed a visible "We are Hiring!" section with repeated responsive inline role cards for Full Stack Engineer (Node & React) | Immediate Joiner in Pune, and that the public application handoff still resolved to the first-party #frmsub anchor on the same page. The local scraper therefore dedupes identical cards across the repeated responsive shells and emits the unique visible India role.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'zimetricstechnologies/jobs.json',
}

export default ZIMETRICS_TECHNOLOGIES_CATALOG
