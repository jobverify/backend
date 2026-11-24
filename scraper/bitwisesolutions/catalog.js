import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BITWISE_SOLUTIONS_CATALOG = {
  source: 'bitwisesolutions',
  companyName: 'Bitwise Solutions',
  officialBrandName: 'Bitwise',
  adapter: 'script',
  homepageUrl: 'https://www.bitwiseglobal.com/',
  companyCareerPage: 'https://www.bitwiseglobal.com/company/careers',
  openingsPageUrl: 'https://www.bitwiseglobal.com/company/careers/openings',
  companyDomain: 'bitwiseglobal.com',
  atsPlatform: 'first-party-current-publication',
  countryFilter: 'India',
  paginationStrategy: 'paired-own-declared-current-listing-and-selected-role-partials;inventory-unknown',
  extractionStrategy:
    'current-own-navigation+exported-listing-programme+anonymous-public-listing-POST+paired-full-role-positive-partials',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  sourceTimeoutMs: 180000,
  verifiedSurfaceSummary:
    'Current Bitwise own navigation declares the rendered CareerListings component, anonymous listing JSON POST, and same-role public handoffs. The source evaluates every current India-group row dynamically and returns only qualified paired publication partials; native dates/legal employer and all company/facet/inventory/cleanup claims remain held.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'bitwisesolutions/jobs.json',
}

export default BITWISE_SOLUTIONS_CATALOG
