import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CREDIT_SUISSE_CATALOG = {
  source: 'creditsuisse',
  companyName: 'Credit Suisse',
  adapter: 'script',
  companyCareerPage: 'https://www.credit-suisse.com/careers/en.html',
  companyDomain: 'credit-suisse.com',
  atsPlatform: 'legacy-brand-redirect-to-ubs-careers',
  countryFilter: 'India',
  paginationStrategy: 'legacy-credit-suisse-careers-redirect-plus-ubs-search-jobs-validation',
  extractionStrategy: 'verified-credit-suisse-redirect-to-ubs-careers+ubs-search-jobs-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  legacyHomepageUrl: 'https://www.credit-suisse.com/us/en.html',
  officialHomepageRedirectUrl: 'https://www.ubs.com/us/en.html',
  officialCareersRedirectUrl: 'https://www.ubs.com/global/en/careers.html',
  officialSearchJobsUrl: 'https://www.ubs.com/global/en/careers/search-jobs.html',
  officialJobsBoardHost: 'https://jobs.ubs.com',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the Credit Suisse U.S. homepage redirects to the UBS U.S. page, whose heading is now UBS United States and still includes Credit Suisse client access and UBS careers links. The Credit Suisse careers URL redirects to UBS Global Careers, and its search-jobs page hands off to jobs.ubs.com. There is no trustworthy Credit Suisse-branded public jobs surface to attribute India roles.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default CREDIT_SUISSE_CATALOG
