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
  employerProfileUrl: 'https://www.linkedin.com/company/airtelpaymentsbank',
  employerCompanyId: '13361480',
  employerListingPath: '/jobs/airtel-payments-bank-jobs-worldwide',
  atsPlatform: 'corporate-declared-linkedin-employer-feed',
  countryFilter: 'India',
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  zeroResultPolicy: 'evidence-required',
  paginationStrategy:
    'exact-employer-worldwide-count-and-terminal+stable-closing-inventory;max-100-native-rows',
  extractionStrategy:
    'corporate-employer-handoff+reciprocal-bank-website+native-JobPosting-and-full-visible-criteria-parity+explicit-country+same-role-account-handoff;whole-company-scope-unverified',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-13',
  verifiedSurfaceSummary:
    'Verified with public TLS on November 13, 2026: https://www.airtelpayments.bank.in/ explicitly links to https://www.linkedin.com/company/airtelpaymentsbank, whose native employer profile reciprocates the bank website and declares the exact Worldwide bank feed f_C=13361480. Its 16 native vacancies, full original descriptions, explicit countries, role-bound account application links and unchanged closing inventory were acquired. Only this employer feed is complete; company-wide totals remain unknown and lifecycle cleanup is forbidden. The former shared https://careers.airtel.com/ handoff still times out; its Darwinbox API alternatives return a public Cloudflare block.',
  dryRunFile: 'airtelpaymentsbank/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AIRTEL_PAYMENTS_BANK_CATALOG
