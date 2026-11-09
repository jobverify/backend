import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG = {
  source: 'rajlaxmisolutionsprivatelimited',
  companyName: 'Rajlaxmi Solutions Private Limited',
  officialBrandName: 'Rajlaxmi',
  adapter: 'script',
  homepageUrl: 'https://rajlaxmiworld.com/',
  companyCareerPage: 'https://rajlaxmiworld.com/join-us/',
  officialCareersPageUrl: 'https://rajlaxmiworld.com/join-us/',
  companyDomain: 'rajlaxmiworld.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-page',
  extractionStrategy: 'verified-first-party-join-us-html-job-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://rajlaxmiworld.com/join-us/ is the live first-party Rajlaxmi join-us page and that it publicly lists current openings including Accountant, Bitrix24 Developer, SAP Business One Functional Consultant, Sales Executive, and ITSales Intern directly in first-party HTML job cards. The verified page exposes concrete experience labels such as Minimum 5 years and Work from Office, so this provider is pinned to the single dated first-party current openings page.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'rajlaxmisolutionsprivatelimited/jobs.json',
}

export default RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG
