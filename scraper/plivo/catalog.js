import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PLIVO_CATALOG = {
  source: 'plivo',
  companyName: 'Plivo',
  officialBrandName: 'Plivo',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'plivo/jobs.json',
  homepageUrl: 'https://www.plivo.com/',
  companyCareerPage: 'https://www.plivo.com/jobs/',
  companyDomain: 'plivo.com',
  officialLeverBoardUrl: 'https://jobs.lever.co/plivo',
  leverApiUrl: 'https://api.lever.co/v0/postings/plivo?mode=json',
  verifiedPublicJobCount: 0,
  atsPlatform: 'lever',
  countryFilter: 'Global',
  paginationStrategy: 'official-jobs-shell-validation-plus-lever-api',
  extractionStrategy:
    'verified-first-party-jobs-page+verified-jobs-bundle-lever-fetch+empty-lever-api+allow-missing-lever-board',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that https://www.plivo.com/jobs/ is still the live official Plivo jobs page, that its current Astro JobsPage client bundle at https://www.plivo.com/_astro/JobsPage.DH20V3RG.js still fetches the public Lever API at https://api.lever.co/v0/postings/plivo?mode=json, and that the live Lever API returned [] on the verified date. Also verified that the legacy public Lever board URL https://jobs.lever.co/plivo now resolves to a Lever-branded 404 page titled "Not found - 404 error" instead of the earlier empty-board layout, while the first-party Plivo page still renders stale "03 open positions" shell copy with no public job records.',
}

export default PLIVO_CATALOG
