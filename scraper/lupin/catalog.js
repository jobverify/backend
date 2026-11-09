import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LUPIN_CATALOG = {
  source: 'lupin',
  companyName: 'Lupin',
  officialBrandName: 'Lupin',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'lupin/jobs.json',
  homepageUrl: 'https://www.lupin.com/',
  companyCareerPage: 'https://careers.lupin.com/content/Current-Opportunities/',
  indiaJobsPageUrl: 'https://careers.lupin.com/go/Lupin-India/9891200/?q=&sortColumn=referencedate&sortDirection=desc',
  companyDomain: 'lupin.com',
  verifiedPublicJobCount: 51,
  atsPlatform: 'successfactors',
  countryFilter: 'India',
  paginationStrategy: 'path-offset-pages-25-results-per-page',
  extractionStrategy: 'india-search-results-table+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.lupin.com/ is the live exact-name first-party Lupin homepage, that https://careers.lupin.com/content/Current-Opportunities/ is the first-party careers landing page, and that the India jobs board at https://careers.lupin.com/go/Lupin-India/9891200/?q=&sortColumn=referencedate&sortDirection=desc is the live public Lupin-India listings surface. Live verification on Thursday, July 16, 2026 confirmed 51 live India jobs across three paginated board pages, with current detail pages such as Officer -Quality Control and Senior Executive - GPO exposing first-party talentcommunity apply handoffs.',
}

export default LUPIN_CATALOG
