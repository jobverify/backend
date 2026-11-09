import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMAZON_PAY_CATALOG = {
  source: 'amazonpay',
  companyName: 'Amazon Pay',
  officialBrandName: 'Amazon Pay',
  adapter: 'script',
  companyCareerPage: 'https://www.amazon.jobs/en/search?base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  searchApiUrl: 'https://www.amazon.jobs/en/search.json?offset=0&result_limit=10&sort=relevant&base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'amazon-jobs-search-json-offset',
  extractionStrategy: 'verified-amazon-jobs-search-page+amazon-jobs-search-json+amazon-pay-signal-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'amazon.jobs',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that Amazon exposes a live first-party Amazon Pay jobs surface on https://www.amazon.jobs/en/search?base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND, whose HTML embeds an Amazon Jobs search request for the exact query "Amazon Pay" with the India country filter. The matching first-party JSON endpoint at https://www.amazon.jobs/en/search.json?offset=0&result_limit=10&sort=relevant&base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND returned 52 public India results during verification, including the detail page https://www.amazon.jobs/en/jobs/10460726/business-analyst-amazon-pay for Business Analyst, Amazon Pay.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AMAZON_PAY_CATALOG
