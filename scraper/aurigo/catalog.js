import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AURIGO_CATALOG = {
  source: 'aurigo',
  companyName: 'Aurigo Software Technologies',
  officialBrandName: 'Aurigo Software Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.aurigo.com/',
  companyCareerPage: 'https://careers.aurigo.com/',
  searchResultsUrl: 'https://careers.aurigo.com/search/?locale=en_US&previewLink=true&referrerSave=false&searchResultView=LIST',
  companyDomain: 'aurigo.com',
  atsPlatform: 'official-first-party-search-api',
  countryFilter: 'India',
  paginationStrategy: 'api-page-number',
  extractionStrategy: 'jobs2web-search-shell+first-party-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://careers.aurigo.com/ links to the live first-party Aurigo Software Technologies job listings search shell at https://careers.aurigo.com/search/?locale=en_US&previewLink=true&referrerSave=false&searchResultView=LIST, and that the first-party POST jobs API at https://careers.aurigo.com/services/recruiting/v1/jobs returns current India openings including Director of Product and Software Engineer II.',
  dryRunFile: 'aurigo/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AURIGO_CATALOG
