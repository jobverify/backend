import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TCS_ION_CATALOG = {
  source: 'tcsion',
  companyName: 'TCS iON',
  officialBrandName: 'TCS iON',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'tcsion/jobs.json',
  officialHomepageUrl: 'https://www.tcsion.com/',
  companyCareerPage: 'https://www.tcsion.com/jobs/',
  sampleMarketplaceListingUrl: 'https://www.tcsion.com/job-openings/jobs-in-hyderabad',
  companyDomain: 'tcsion.com',
  atsPlatform: 'first-party-jobs-marketplace-no-exact-name-employer-surface',
  countryFilter: 'India',
  paginationStrategy: 'verified-jobs-marketplace-home-without-exact-name-tcsion-listings',
  extractionStrategy:
    'verified-first-party-marketplace+generic-multi-company-hiring-surface-without-exact-name-tcsion-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.tcsion.com/jobs/ is still the live first-party TCS iON jobs marketplace page titled "TCS iON Jobs: Explore opportunities and give your career a boost", but its hero copy now emphasizes "Unlock Career Opportunities with AI Precision Matching" rather than the older search prompt. The page still describes opportunities from leading companies and its featured hiring section lists unrelated employers such as Nest Digital, TATA ELXSI, Publicis sapient, Vedantu, and Presistent rather than an exact-name TCS iON employer feed. Verified on Friday, August 14, 2026 that the first-party listing route https://www.tcsion.com/job-openings/jobs-in-hyderabad still exposes generic marketplace results from unrelated employers such as VISYS CLOUD TECHNOLOGIES INDIA PRIVATE LIMITED rather than an exact-name TCS iON feed. There is no trustworthy exact-name TCS iON employer jobs surface on these first-party pages as of August 14, 2026, so this provider intentionally fails closed and returns an empty array until TCS iON publishes a trustworthy exact-name public jobs feed.',
}

export default TCS_ION_CATALOG
