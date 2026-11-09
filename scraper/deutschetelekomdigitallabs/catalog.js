import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG = {
  source: 'deutschetelekomdigitallabs',
  companyName: 'Deutsche Telekom Digital Labs',
  officialBrandName: 'Deutsche Telekom Digital Labs',
  adapter: 'script',
  homepageUrl: 'https://dtdl.in/',
  companyCareerPage: 'https://dtdl.in/',
  telekomWorldwidePageUrl: 'https://www.telekom.com/en/company/worldwide',
  companyDomain: 'dtdl.in',
  atsPlatform: 'affiliate-page-plus-exact-name-shell-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'affiliate-page-plus-shell-validation',
  extractionStrategy: 'telekom-affiliate-page+exact-name-legacy-or-modern-shell+common-route-validation-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://www.telekom.com/en/company/worldwide still identifies that DT Digital Labs in India is responsible for product development and links to https://dtdl.in/, and that the exact-name first-party host plus https://dtdl.in/careers, https://dtdl.in/jobs, and https://dtdl.in/join-us now resolve to the modern DTDL app shell with the canonical root at https://dtdl.in/ and no trustworthy public jobs exposed in the server-rendered HTML.',
  dryRunFile: 'deutschetelekomdigitallabs/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG
