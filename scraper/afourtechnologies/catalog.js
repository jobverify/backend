import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 1, 2026 that https://afourtech.com/careers-3/ remained the live first-party AFour Technologies careers page and publicly listed six live role blocks including Cobol Developer, Senior SDET Performance, Lead SDET, Sr. SDE Java, Lead SDET Enterprise Analytics Testing, and Sr. Python Developer with first-party Apply Now detail links.'

export const AFOUR_TECHNOLOGIES_CATALOG = {
  source: 'afourtechnologies',
  companyName: 'AFour Technologies',
  officialBrandName: 'AFour Technologies',
  adapter: 'script',
  homepageUrl: 'https://afourtech.com/',
  companyCareerPage: 'https://afourtech.com/careers-3/',
  companyDomain: 'afourtech.com',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-elementor-job-columns',
  extractionStrategy: 'verified-first-party-careers-page+elementor-job-columns+first-party-role-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedPublicJobCount: 6,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'afourtechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AFOUR_TECHNOLOGIES_CATALOG
