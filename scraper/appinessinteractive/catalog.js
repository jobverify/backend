import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://www.appinessworld.com/careers/job-details/ remained the live first-party Appiness Interactive careers page and that it publicly exposes same-page role sections for Bangalore applicants via the current Role / Experience / Location blocks followed by same-page Submit Application modals. The verified page showed 25 public openings on the first-party surface, including SEO Expert, Python Developer, MERN Stack Developer, and Project Manager | Scrum Master.'

export const APPINESS_INTERACTIVE_CATALOG = {
  source: 'appinessinteractive',
  companyName: 'Appiness Interactive',
  officialBrandName: 'Appiness Interactive Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.appinessworld.com/',
  companyCareerPage: 'https://www.appinessworld.com/careers/job-details/',
  companyDomain: 'appinessworld.com',
  atsPlatform: 'official-first-party-role-sections',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'same-page-role-sections',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedPublicOpeningCount: 25,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'appinessinteractive/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default APPINESS_INTERACTIVE_CATALOG
