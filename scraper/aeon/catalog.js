import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AEON_CATALOG = {
  source: 'aeon',
  companyName: 'AEON',
  officialBrandName: 'Aeon Credit',
  legalEntityName: 'AEON Credit Service India Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://www.aeoncredit.co.in/careers',
  companyDomain: 'aeoncredit.co.in',
  joinUsUrl: 'https://www.aeoncredit.co.in/careers/join-us',
  jobListingsUrl: 'https://careers-aeoncredit.peoplestrong.com/job/joblist',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-pages-plus-blocked-peoplestrong-handoff',
  extractionStrategy:
    'verified-official-homepage+verified-careers-hub+verified-join-us-page+declared-peoplestrong-access-failure-with-unknown-inventory',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    "Verified on July 14, 2026 that https://www.aeoncredit.co.in/ is the live AEON Credit India homepage, https://www.aeoncredit.co.in/careers is the first-party careers hub, and https://www.aeoncredit.co.in/careers/join-us is the first-party join-us page that links View Job Vacancy to https://careers-aeoncredit.peoplestrong.com/job/joblist. There is no trustworthy public jobs surface: the linked PeopleStrong joblist and its public jobs API returned 403 Forbidden during live checks, so AEON's India careers surface is currently only a first-party informational handoff plus email contact rather than a usable public job board.",
  modulePath: path.join(currentDir, 'script.js'),
}

export default AEON_CATALOG
