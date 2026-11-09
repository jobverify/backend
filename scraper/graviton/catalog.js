import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GRAVITON_CATALOG = {
  source: 'graviton',
  companyName: 'Graviton',
  officialBrandName: 'Graviton Research Capital LLP',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'graviton/jobs.json',
  officialHomepageUrl: 'https://www.gravitontrading.com/',
  companyCareerPage: 'https://www.gravitontrading.com/careers',
  embeddedJobsPageUrl: 'https://www.gravitontrading.com/greenhouse-embed-local.html',
  firstPartyJobsJsonUrl: 'https://www.gravitontrading.com/data/greenhouse_jobs.json',
  greenhouseBoardUrl: 'https://boards.greenhouse.io/embed/job_board?for=gravitonresearchcapital',
  companyDomain: 'gravitontrading.com',
  atsPlatform: 'first-party-greenhouse-jobs-json',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-json-page',
  extractionStrategy:
    'verified-first-party-careers-page+verified-first-party-embedded-jobs-page+first-party-jobs-json+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.gravitontrading.com/careers is the live first-party Graviton careers page, that it embeds the first-party jobs shell at https://www.gravitontrading.com/greenhouse-embed-local.html, and that the same first-party shell loads https://www.gravitontrading.com/data/greenhouse_jobs.json as the public jobs feed. Live verification on July 17, 2026 confirmed that the first-party jobs JSON returned 22 jobs in total and 16 India jobs, including Application Reliability Engineer in Gurugram, Haryana, India. This provider is pinned to those verified first-party Graviton surfaces and filters to India jobs only.',
}

export default GRAVITON_CATALOG
