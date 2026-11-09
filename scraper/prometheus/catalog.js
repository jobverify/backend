import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROMETHEUS_CATALOG = {
  source: 'prometheus',
  companyName: 'Prometheus',
  officialBrandName: 'Prometheus',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'prometheus/jobs.json',
  homepageUrl: 'https://prometheus.io/',
  companyCareerPage: null,
  overviewUrl: 'https://prometheus.io/docs/introduction/overview/',
  governanceUrl: 'https://prometheus.io/governance/',
  companyDomain: 'prometheus.io',
  atsPlatform: 'open-source-project-no-company-careers',
  countryFilter: 'Global',
  paginationStrategy: 'verified-homepage-plus-overview-plus-governance-route-validation',
  extractionStrategy:
    'verified-homepage+verified-independent-project-overview+verified-open-governance+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://prometheus.io/ was the live official Prometheus homepage and described the project as open source and community-driven, that the first-party overview at https://prometheus.io/docs/introduction/overview/ stated Prometheus is a standalone open source project maintained independently of any company, and that the first-party governance page at https://prometheus.io/governance/ said steering-committee seats are held by individuals rather than by employers. Because the official project presents Prometheus as an independent open source project rather than an employer with a public careers surface, this provider is an honest fail-closed sentinel that returns no jobs until first-party hiring evidence exists.',
}

export default PROMETHEUS_CATALOG
