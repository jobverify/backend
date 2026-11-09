import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LYBRATE_CATALOG = {
  source: 'lybrate',
  companyName: 'Lybrate',
  officialBrandName: 'Lybrate',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'lybrate/jobs.json',
  homepageUrl: 'https://www.lybrate.com/',
  jobsPageUrl: 'https://www.lybrate.com/jobs',
  aboutPageUrl: 'https://www.lybrate.com/about',
  embeddedJobsApiUrl: 'https://api.lever.co/v0/postings/lybrate?group=team&mode=json',
  companyDomain: 'lybrate.com',
  atsPlatform: 'official-jobs-page-with-dead-embedded-api',
  countryFilter: 'India',
  paginationStrategy: 'stale-first-party-jobs-shell-validation',
  extractionStrategy: 'verified-first-party-jobs-page+dead-embedded-api+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedPublicPostingCount: 0,
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.lybrate.com/about still sends its hiring CTA to the first-party page at https://www.lybrate.com/jobs, but that the jobs route is now misconfigured into a first-party redirect loop: https://www.lybrate.com/jobs returns HTTP 301 with Location: https://www.lybrate.com/jobs while https://www.lybrate.com/jobs/ returns HTTP 308 with Location: /jobs. Verified that the embedded Lever URL https://api.lever.co/v0/postings/lybrate?group=team&mode=json still returns HTTP 404 with {"ok":false,"error":"Document not found"}. There is no trustworthy live public Lybrate jobs surface to scrape at this time, so this provider now treats that self-redirecting jobs route plus the dead Lever response as the authoritative empty public state.',
}

export default LYBRATE_CATALOG
