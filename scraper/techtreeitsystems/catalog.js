import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHTREE_IT_SYSTEMS_CATALOG = {
  source: 'techtreeitsystems',
  companyName: 'Techtree It Systems',
  officialBrandName: 'TechTree IT System Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://www.techtreeit.com/',
  companyCareerPage: 'https://www.techtreeit.com/careers/',
  companyDomain: 'techtreeit.com',
  atsPlatform: 'wp-job-openings',
  countryFilter: 'India',
  paginationStrategy: 'partial-inline-first-party-awsm-careers-page',
  extractionStrategy:
    'http-200-first-party-careers+inline-awsm-cards+validated-native-detail-publication|blocked-and-detail-errors-fail-closed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Historical August 15, 2026 evidence observed a Sucuri challenge with the title "You are being redirected..."; this is blocked inventory, never proof of zero jobs. Local repair accepts only HTTP 200 on the exact careers surface and extracts inline wp-job-openings cards with validated native identity, published status, original GMT publication and explicit role country. HTTP 500 HTML and failed details reject extraction. Inline pagination and whole-company scope remain incomplete; no current successful runtime verification is claimed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'techtreeitsystems/jobs.json',
}

export default TECHTREE_IT_SYSTEMS_CATALOG
