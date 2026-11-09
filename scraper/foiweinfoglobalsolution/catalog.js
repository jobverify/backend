import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.foiwe.com/career/ was the live first-party Foiwe Info Global Solutions careers page, that it exposed accordion openings including HR Recruiter, Full-Stack Developer, and Japanese Social Media Manager, and that each opening linked to a first-party detail page alongside a Join Our Team application form.'

export const FOIWE_INFO_GLOBAL_SOLUTION_CATALOG = {
  source: 'foiweinfoglobalsolution',
  companyName: 'Foiwe Info Global Solution',
  officialBrandName: 'Foiwe Info Global Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.foiwe.com/',
  companyCareerPage: 'https://www.foiwe.com/career/',
  companyDomain: 'foiwe.com',
  atsPlatform: 'official-company-careers-accordion',
  countryFilter: 'India',
  paginationStrategy: 'single-page-accordion-openings',
  extractionStrategy: 'verified-careers-accordion+learn-more-detail-pages+join-our-team-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'foiweinfoglobalsolution/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FOIWE_INFO_GLOBAL_SOLUTION_CATALOG
