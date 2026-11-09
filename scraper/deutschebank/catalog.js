import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://careers.db.com/ is the live Deutsche Bank Careers homepage, that its homepage Search Roles CTA now uses the relative first-party route /professionals/search-roles, and that https://careers.db.com/professionals/search-roles/ remains the live first-party Search Roles surface with the PROFESSIONAL job module and careersJs.js asset. Verified that the public country lookup at https://api-deutschebank.beesite.de/lookup/country/lang/2 still maps India to 81, that the professional search API at https://api-deutschebank.beesite.de/search/?data=... returned 234 India roles, and that the public detail JSON at https://api-deutschebank.beesite.de/jobhtml/74791.json exposed the live India role "Salesperson - VP" with a Workday apply URL.'

export const DEUTSCHE_BANK_CATALOG = {
  source: 'deutschebank',
  companyName: 'Deutsche Bank',
  officialBrandName: 'Deutsche Bank',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'deutschebank/jobs.json',
  officialHomepageUrl: 'https://careers.db.com/',
  companyCareerPage: 'https://careers.db.com/professionals/search-roles/',
  publicCountryLookupUrl: 'https://api-deutschebank.beesite.de/lookup/country/lang/2',
  publicSearchApiUrl: 'https://api-deutschebank.beesite.de/search',
  publicJobDetailApiPrefix: 'https://api-deutschebank.beesite.de/jobhtml/',
  verifiedIndiaCountryId: 81,
  verifiedIndiaCountryLabel: 'India',
  verifiedIndiaSampleJobId: '74791',
  verifiedIndiaSampleApplyUrl:
    'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Mumbai-Capital/Salesperson---VP_R0443973/apply',
  companyDomain: 'db.com',
  atsPlatform: 'first-party-beesite-search-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-pages-plus-beesite-countitem-expansion',
  extractionStrategy:
    'verified-careers-homepage+verified-search-roles-page+public-country-lookup+public-professional-search-api+public-job-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DEUTSCHE_BANK_CATALOG
