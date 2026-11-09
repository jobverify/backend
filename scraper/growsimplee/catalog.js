import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GROW_SIMPLEE_CATALOG = {
  source: 'growsimplee',
  companyName: 'GrowSimplee',
  officialBrandName: 'GrowSimplee',
  adapter: 'script',
  homepageUrl: 'https://growsimplee.com/',
  companyCareerPage: 'https://growsimplee.com/careers',
  trustedApiDocsUrl: 'https://api-docs.growsimplee.com/',
  technicalContactEmail: 'tech@growsimplee.com',
  firstPartyRouteExpectations: [
    { url: 'https://growsimplee.com/', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/', errorKind: 'tls' },
    { url: 'https://growsimplee.com/careers', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/careers', errorKind: 'tls' },
    { url: 'https://growsimplee.com/jobs', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/jobs', errorKind: 'tls' },
    { url: 'https://growsimplee.com/about', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/about', errorKind: 'tls' },
  ],
  companyDomain: 'growsimplee.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-api-docs-plus-first-party-route-unavailability-validation',
  extractionStrategy: 'verified-first-party-api-docs+exact-name-routes-timeout-or-tls-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://api-docs.growsimplee.com/ was the reachable first-party GrowSimplee API documentation surface, carrying Blitz External APIs onboarding copy plus the technical contact tech@growsimplee.com. Direct probes to https://growsimplee.com/, https://www.growsimplee.com/, https://growsimplee.com/careers, https://www.growsimplee.com/careers, https://growsimplee.com/jobs, https://www.growsimplee.com/jobs, https://growsimplee.com/about, and https://www.growsimplee.com/about either timed out or failed TLS trust validation, so no trustworthy public jobs surface was verifiable on Friday, July 17, 2026.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default GROW_SIMPLEE_CATALOG
