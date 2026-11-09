import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RAPID7_INDIA_CATALOG = {
  source: 'rapid7india',
  companyName: 'Rapid7 India',
  officialBrandName: 'Rapid7',
  adapter: 'script',
  companyCareerPage: 'https://careers.rapid7.com/jobs/search',
  officialCareersPageUrl: 'https://careers.rapid7.com/jobs/search',
  jobPagePrefix: 'https://careers.rapid7.com/jobs/',
  companyDomain: 'rapid7.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-search-page-pagination-plus-india-location-filter',
  extractionStrategy: 'verified-first-party-search-page+server-rendered-job-table+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the official Rapid7 public jobs surface for this exact-name provider was the first-party search page at https://careers.rapid7.com/jobs/search. The live unauthenticated search index exposed 6 public rows on that date, including Channel Account Manager and Vice President, Artificial Intelligence, but no India roles were publicly listed in the current first-party index, so this exact-name provider is pinned to the verified search page and currently returns an honest empty India slice until trusted India rows reappear there.',
  dryRunFile: 'rapid7india/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RAPID7_INDIA_CATALOG
