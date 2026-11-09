import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SONATYPE_CATALOG = {
  source: 'sonatype',
  companyName: 'Sonatype',
  officialBrandName: 'Sonatype',
  adapter: 'script',
  homepageUrl: 'https://www.sonatype.com/',
  companyCareerPage: 'https://www.sonatype.com/company/careers',
  officialLeverBoardUrl: 'https://jobs.lever.co/sonatype',
  leverApiUrl: 'https://api.lever.co/v0/postings/sonatype?mode=json',
  companyDomain: 'sonatype.com',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-validation-plus-lever-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-lever-board+lever-postings-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    "Verified on Saturday, July 25, 2026 that https://www.sonatype.com/company/careers is Sonatype's live first-party careers page and that it links applicants to the official Lever board at https://jobs.lever.co/sonatype. Verified that the public Sonatype Lever board currently includes Hyderabad roles for India, so this provider trusts the first-party careers handoff plus the official public Lever postings API at https://api.lever.co/v0/postings/sonatype?mode=json and keeps only India jobs.",
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SONATYPE_CATALOG
