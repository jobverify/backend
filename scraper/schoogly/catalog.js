import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCHOOGLY_CATALOG = {
  source: 'schoogly',
  companyName: 'Schoogly',
  officialBrandName: 'Schoogly',
  adapter: 'script',
  companyCareerPage: 'https://schoogly.com/',
  homepageUrl: 'https://schoogly.com/',
  companyDomain: 'schoogly.com',
  atsPlatform: 'exact-name-domain-timeout-unverifiable',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-first-party-route-timeout-validation',
  extractionStrategy: 'candidate-exact-name-first-party-routes-timeout-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that exact-name web searches for "Schoogly" and "Schoogly careers" did not surface a trustworthy first-party careers page. Direct live probes to https://schoogly.com/, https://www.schoogly.com/, https://schoogly.com/careers, https://www.schoogly.com/careers, https://schoogly.com/jobs, and https://www.schoogly.com/jobs all timed out, with curl reporting "Connection timed out" after about five seconds on every exact-name route. There is no trustworthy public jobs surface for Schoogly on Friday, July 17, 2026, so this sentinel fails closed and returns no jobs until a trusted first-party careers surface becomes verifiable.',
  firstPartyTimeoutUrls: [
    'https://schoogly.com/',
    'https://www.schoogly.com/',
    'https://schoogly.com/careers',
    'https://www.schoogly.com/careers',
    'https://schoogly.com/jobs',
    'https://www.schoogly.com/jobs',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SCHOOGLY_CATALOG
