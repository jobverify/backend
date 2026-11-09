import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that the legacy https://www.finobank.com/ route fails TLS renegotiation in this runtime, while the first-party https://www.fino.bank.in/ homepage is reachable and embeds its Company Careers link to https://www.fino.bank.in/company/careers in navigation data. The careers page still renders Open Roles and No Roles Found without job detail, application, or ATS links. The six adjacent career and jobs routes remain first-party 404s. There is no trustworthy public jobs surface right now.'

export const FINO_PAYMENTS_BANK_CATALOG = {
  source: 'finopaymentsbank',
  companyName: 'Fino Payments Bank',
  officialBrandName: 'Fino Payments Bank',
  adapter: 'script',
  legacyHomepageUrl: 'https://www.finobank.com/',
  homepageUrl: 'https://www.fino.bank.in/',
  companyCareerPage: 'https://www.fino.bank.in/company/careers',
  alternateRouteUrls: [
    'https://www.fino.bank.in/careers',
    'https://www.fino.bank.in/career',
    'https://www.fino.bank.in/jobs',
    'https://www.fino.bank.in/join-us',
    'https://www.fino.bank.in/work-with-us',
    'https://www.fino.bank.in/current-openings',
  ],
  atsPlatform: 'official-company-careers-nonlisting',
  companyDomain: 'fino.bank.in',
  countryFilter: 'India',
  paginationStrategy:
    'legacy-homepage-redirect-plus-homepage-careers-handoff-plus-nonlisting-careers-page-and-404-alternate-route-validation',
  extractionStrategy:
    'verified-legacy-homepage-redirect+verified-homepage-careers-link+verified-careers-page-open-roles-no-roles-found+verified-alternate-careers-routes-404-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'finopaymentsbank/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FINO_PAYMENTS_BANK_CATALOG
