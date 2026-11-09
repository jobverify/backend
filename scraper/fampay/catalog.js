import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.famapp.in/careers/ is the live first-party careers page for FamApp by Trio (formerly FamPay), that the current careers bundle at https://www.famapp.in/_next/static/chunks/a57fc16ab57e4e2c.js wires the View openings CTA to the first-party jobs route, and that https://www.famapp.in/jobs/ is the live first-party jobs shell whose current bundle at https://www.famapp.in/_next/static/chunks/46b0e91d4324e433.js calls the grouped public Lever API at https://api.lever.co/v0/postings/fampay?group=team&mode=json. Verified the companion public Lever board at https://jobs.lever.co/fampay and the live sample detail page at https://jobs.lever.co/fampay/7c59fd4b-508e-4a91-9d73-164bc7d9abba. The grouped Lever API returned 7 teams, 17 public postings, and 17 India roles, all with country code IN and Bengaluru locations.'

export const FAMPAY_CATALOG = {
  source: 'fampay',
  companyName: 'Fampay',
  officialBrandName: 'FamApp by Trio',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'fampay/jobs.json',
  officialHomepageUrl: 'https://www.famapp.in/',
  companyCareerPage: 'https://www.famapp.in/careers/',
  officialJobsPageUrl: 'https://www.famapp.in/jobs/',
  careersBundleUrl: 'https://www.famapp.in/_next/static/chunks/a57fc16ab57e4e2c.js',
  jobsBundleUrl: 'https://www.famapp.in/_next/static/chunks/46b0e91d4324e433.js',
  officialLeverBoardUrl: 'https://jobs.lever.co/fampay',
  leverApiUrl: 'https://api.lever.co/v0/postings/fampay?group=team&mode=json',
  companyDomain: 'famapp.in',
  verifiedIndiaCountryCode: 'IN',
  verifiedLeverGroupCount: 7,
  verifiedLeverPostingCount: 17,
  verifiedIndiaRoleCount: 17,
  verifiedLeverLocation: 'Bengaluru',
  verifiedSampleJobUrl: 'https://jobs.lever.co/fampay/7c59fd4b-508e-4a91-9d73-164bc7d9abba',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-shell-plus-first-party-jobs-shell-bundle-plus-grouped-lever-api',
  extractionStrategy:
    'verified-careers-page+verified-careers-bundle-jobs-handoff+verified-jobs-shell+verified-jobs-bundle+grouped-lever-postings-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FAMPAY_CATALOG
