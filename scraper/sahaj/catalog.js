import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAHAJ_CATALOG = {
  source: 'sahaj',
  companyName: 'Sahaj',
  officialBrandName: 'Sahaj Retail Limited',
  adapter: 'script',
  homepageUrl: 'https://www.sahaj.co.in/',
  aboutPageUrl: 'https://retail.sahaj.co.in/web/retail/about-us',
  companyCareerPage: 'https://retail.sahaj.co.in/joinuspage',
  jobRolePageUrl: 'https://retail.sahaj.co.in/web/retail/job-role-page',
  companyDomain: 'sahaj.co.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-about-plus-join-us-plus-job-role-validation',
  extractionStrategy:
    'verified-homepage+verified-about-page+verified-join-us-partner-registration+verified-job-role-external-job-seeker-service-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sahaj.co.in/ was the live first-party Sahaj homepage for Sahaj Retail Limited, that https://retail.sahaj.co.in/web/retail/about-us remained the official About Us page, that https://retail.sahaj.co.in/joinuspage was a Sahaj Mitr partner-registration flow rather than a company careers board, and that https://retail.sahaj.co.in/web/retail/job-role-page described an external job-seeker registration service for tied-up organizations rather than public Sahaj employee vacancies. There is no trustworthy public company jobs surface for the exact-name Sahaj backlog row on the verified first-party domain.',
  dryRunFile: 'sahaj/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SAHAJ_CATALOG
