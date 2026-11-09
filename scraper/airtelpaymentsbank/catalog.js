import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AIRTEL_PAYMENTS_BANK_CATALOG = {
  source: 'airtelpaymentsbank',
  companyName: 'Airtel Payments Bank',
  officialBrandName: 'Airtel Payments Bank',
  adapter: 'script',
  companyCareerPage: 'https://www.airtelpayments.bank.in/',
  aboutPageUrl: 'https://www.airtelpayments.bank.in/static/about-us',
  parentCareersPage: 'https://careers.airtel.com/',
  sharedCareersBundleUrl: 'https://careers.airtel.com/static/js/main.57023176.js',
  sharedDarwinboxUrl: 'https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  sharedCareersApiUrl: 'https://careersapi.airtel.com/',
  companyDomain: 'airtelpayments.bank.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    '403-guarded-bank-pages-plus-shared-airtel-careers-shell-bundle-and-darwinbox-checks',
  extractionStrategy:
    '403-guarded-bank-homepage+403-guarded-bank-about-page+shared-airtel-careers-shell+shared-bundle-reference+shared-darwinbox-shell+no-distinct-bank-jobs-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Friday, August 7, 2026 that https://www.airtelpayments.bank.in/ and https://www.airtelpayments.bank.in/static/about-us returned Cloudflare-guarded HTTP 403 surfaces from this environment, while the shared Airtel careers shell at https://careers.airtel.com/, its bundle at https://careers.airtel.com/static/js/main.57023176.js, and the shared Airtel Darwinbox handoff at https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs remained publicly reachable and still exposed no distinct Airtel Payments Bank public jobs route.',
  dryRunFile: 'airtelpaymentsbank/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AIRTEL_PAYMENTS_BANK_CATALOG
