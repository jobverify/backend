import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const POCKETBASE_CATALOG = {
  source: 'pocketbase',
  companyName: 'PocketBase',
  officialBrandName: 'PocketBase',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pocketbase/jobs.json',
  homepageUrl: 'https://pocketbase.io/',
  companyCareerPage: null,
  faqPageUrl: 'https://pocketbase.io/faq/',
  companyDomain: 'pocketbase.io',
  atsPlatform: 'open-source-project-no-company-careers',
  countryFilter: 'Global',
  paginationStrategy: 'verified-homepage-plus-faq-route-validation',
  extractionStrategy:
    'verified-homepage+verified-faq-personal-open-source-project-statement+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://pocketbase.io/ was the live official PocketBase homepage with the hero statement "Open Source backend in 1 file", and that the first-party FAQ at https://pocketbase.io/faq/ explicitly stated "PocketBase is neither a startup, nor a business", "There is no paid team or company behind it.", and that it is a "personal open source project" developed on volunteer basis. Because the official project identifies itself as a personal open source project rather than an employer with a public careers surface, this provider is an honest fail-closed sentinel that returns no jobs until first-party hiring evidence exists.',
}

export default POCKETBASE_CATALOG
