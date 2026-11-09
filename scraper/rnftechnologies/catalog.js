import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RNF_TECHNOLOGIES_CATALOG = {
  source: 'rnftechnologies',
  companyName: 'RNF Technologies',
  officialBrandName: 'RNF Technologies',
  adapter: 'script',
  homepageUrl: 'https://rnftechnologies.com/join-our-team',
  companyCareerPage: 'https://rnftechnologies.com/join-our-team/current-openings',
  officialCareersPageUrl: 'https://rnftechnologies.com/join-our-team/current-openings',
  companyDomain: 'rnftechnologies.com',
  atsPlatform: 'official-first-party-job-table-plus-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-current-openings-page',
  extractionStrategy: 'complete-current-role-cards+jsonld-details+legacy-job-table',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    'Verified September 13, 2026: RNF publishes seven current role cards and a matching ItemList count. Each role detail provides exact-employer JobPosting JSON-LD, an India location, canonical job URL and identifier. Incomplete lists and mismatched details are rejected.',
  dryRunFile: 'rnftechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RNF_TECHNOLOGIES_CATALOG
