import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DANSKE_IT_CATALOG = {
  source: 'danskeit',
  companyName: 'Danske IT',
  officialBrandName: 'Danske IT',
  adapter: 'script',
  homepageUrl: 'https://danskebank.com/careers',
  companyCareerPage: 'https://danskebank.com/careers',
  supportingEvidenceUrl: 'https://danskebank.com/news-and-insights/news-archive/press-releases/2023/pr26062023',
  atsPlatform: 'legacy-brand-no-exact-name-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'parent-brand-careers-page-plus-legacy-transition-notice',
  extractionStrategy: 'verified-parent-brand-careers-page+verified-legacy-sale-notice+no-exact-name-public-jobs-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'danskebank.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the official Danske Bank press release published on June 26, 2023 states Danske Bank will sell Danske IT and transfer colleagues from 1 September 2023, while the current parent-brand careers page routes openings through generic Danske Bank Oracle Cloud listings and does not expose a standalone exact-name public careers surface for Danske IT.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DANSKE_IT_CATALOG
