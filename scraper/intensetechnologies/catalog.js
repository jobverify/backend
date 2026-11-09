import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://www.in10stech.com/careers remains the live first-party Intense Technologies careers page, that it still embeds window.khConfig plus https://intense.keka.com/careers/api/embedjobs/js/fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce on the official domain, and that https://intense.keka.com/careers/api/organization/default/careerportalinfo plus https://intense.keka.com/careers/api/embedjobs/default/active/fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce returned the public Intense Technologies portal with 1 active India opening, Template Designer Lead.'

export const INTENSE_TECHNOLOGIES_CATALOG = {
  source: 'intensetechnologies',
  companyName: 'Intense Technologies',
  officialBrandName: 'Intense Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.in10stech.com/',
  companyCareerPage: 'https://www.in10stech.com/careers',
  careerPortalInfoUrl: 'https://intense.keka.com/careers/api/organization/default/careerportalinfo',
  expectedKekaDomain: 'https://intense.keka.com/careers/',
  expectedIdentifier: 'fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce',
  companyDomain: 'in10stech.com',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-page+inline-window-khConfig+keka-careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'intensetechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INTENSE_TECHNOLOGIES_CATALOG
