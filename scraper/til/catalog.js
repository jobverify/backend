import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TIL_CATALOG = {
  source: 'til',
  companyName: 'TIL',
  officialBrandName: 'Tractors India Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'til/jobs.json',
  companyCareerPage: 'https://www.tilindia.in/careers/vacancies',
  officialCareersPageUrl: 'https://www.tilindia.in/careers/vacancies',
  companyDomain: 'tilindia.in',
  atsPlatform: 'official-company-site-resume-intake-no-public-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-submit-cv-sentinel',
  extractionStrategy: 'verified-careers-page+resume-intake+no-public-role-cards+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.tilindia.in/careers/vacancies is the live first-party TIL careers page, that it presents the headings "We are Hiring!" and "Current Openings", and that the page currently tells candidates "You may submit your CV here and we will consider the same as and when suitable opportunities arise." The verified page exposes recruitment@tilindia.com and a resume-submission flow, but it does not expose trustworthy public role cards, job-detail pages, or a public ATS jobs surface, so this provider fails closed and returns no jobs until TIL publishes structured public openings.',
}

export default TIL_CATALOG
