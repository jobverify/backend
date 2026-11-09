import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Tuesday, August 4, 2026 that https://www.purplestylelabs.com/careers is still the live official Purple Style Labs careers page, that it still invites applicants to email careers@purplestylelabs.com, and that its visible BROWSE OPPORTUNITIES action still hands candidates to a public LinkedIn jobs search surface filtered to Purple Style Labs (PSL) via company filter 10277228. The page title now renders as Purple Style Labs, but no trustworthy first-party public jobs board is exposed on the exact company domain, so this provider remains a fail-closed sentinel that returns no jobs until a real first-party public hiring surface appears.'

export const PURPLE_STYLE_LABS_CATALOG = {
  source: 'purplestylelabs',
  companyName: 'Purple Style Labs',
  officialBrandName: 'Purple Style Labs',
  adapter: 'script',
  homepageUrl: 'https://www.purplestylelabs.com/',
  companyCareerPage: 'https://www.purplestylelabs.com/careers',
  officialCareersEmail: 'careers@purplestylelabs.com',
  officialLinkedInJobsHost: 'https://www.linkedin.com/jobs/search/',
  officialLinkedInCompanyId: '10277228',
  officialLinkedInCompanyLabel: 'Purple Style Labs (PSL)',
  companyDomain: 'purplestylelabs.com',
  atsPlatform: 'official-company-careers-linkedin-jobs-handoff-no-first-party-jobs-board',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-validation-only',
  extractionStrategy: 'verified-first-party-careers-page+linkedin-jobs-search-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'purplestylelabs/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PURPLE_STYLE_LABS_CATALOG
