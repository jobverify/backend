import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const POSTHOG_CATALOG = {
  source: 'posthog',
  companyName: 'PostHog',
  officialBrandName: 'PostHog',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'posthog/jobs.json',
  companyCareerPage: 'https://posthog.com/careers',
  discoveryCareerPageDataUrl: 'https://posthog.com/page-data/careers/product-engineer/page-data.json',
  companyDomain: 'posthog.com',
  atsPlatform: 'posthog-first-party-gatsby-page-data',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-html-plus-same-domain-gatsby-page-data-current-empty-india-slice',
  extractionStrategy:
    'verified-first-party-careers-page+same-domain-gatsby-page-data+timezone-scan+return-empty-when-no-india-signals',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedPublicJobCount: 8,
  verifiedIndiaJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://posthog.com/careers exposed same-domain career details and that https://posthog.com/page-data/careers/product-engineer/page-data.json enumerated eight current roles, including AI Research Engineer, Product Engineer, and Technical Customer Success Manager - Americas. Their published timezone fields show zero India timezones.',
}

export default POSTHOG_CATALOG
