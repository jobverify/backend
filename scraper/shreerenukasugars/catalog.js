import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHREE_RENUKA_SUGARS_CATALOG = {
  source: 'shreerenukasugars',
  companyName: 'Shree Renuka Sugars',
  officialBrandName: 'Shree Renuka Sugars Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://renukasugars.com/',
  companyCareerPage: 'https://renukasugars.com/join-the-team/',
  officialJobBoardUrl: 'https://renukasugars.com/join-the-team/',
  companyDomain: 'renukasugars.com',
  atsPlatform: 'official-company-careers-inline-job-table',
  countryFilter: 'India',
  paginationStrategy: 'single-static-careers-page',
  extractionStrategy:
    'verified-first-party-join-the-team-page+inline-opportunities-grid+careers-page-apply-fallback',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://renukasugars.com/join-the-team/ is the live first-party Shree Renuka Sugars careers page and that it publicly lists current opportunities directly on the company domain. Verified visible openings include Legal Executive and Corporate Communication Head, both shown for Worli, so the provider parses the inline opportunities grid conservatively from the static first-party HTML.',
  dryRunFile: 'shreerenukasugars/jobs.json',
}

export default SHREE_RENUKA_SUGARS_CATALOG
