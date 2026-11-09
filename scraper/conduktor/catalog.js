import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CONDUKTOR_CATALOG = {
  source: 'conduktor',
  companyName: 'Conduktor',
  officialBrandName: 'Conduktor',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'conduktor/jobs.json',
  homepageUrl: 'https://www.conduktor.io/',
  companyCareerPage: 'https://www.conduktor.io/careers',
  openRolesPageUrl: 'https://www.conduktor.io/careers/open-roles',
  companyDomain: 'conduktor.io',
  atsPlatform: 'official-company-careers-empty-shell',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-open-roles-empty-state',
  extractionStrategy:
    'verified-first-party-careers-page+verified-open-roles-empty-state-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.conduktor.io/careers was the live first-party Conduktor careers page with Open Roles / View Open Roles calls to action, and that the exact first-party open roles page at https://www.conduktor.io/careers/open-roles currently states "No Open Roles Right Now" and "We don\'t have any open positions at the moment". No trustworthy public Conduktor job listings were exposed on the verified first-party surface, so this provider should return an honest empty result until the official page changes.',
}

export default CONDUKTOR_CATALOG
