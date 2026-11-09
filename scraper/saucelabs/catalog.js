import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://saucelabs.com/careers is the live official Sauce Labs careers page, that the browser-rendered first-party page exposes the Current positions at Sauce Labs section with 17 public roles and an India hub in National Capital Region, New Delhi, and that live browser inspection confirmed the official page requests the public Greenhouse jobs endpoint at https://boards-api.greenhouse.io/v1/boards/saucelabs/jobs?content=true. Verified that the Greenhouse payload returned 17 public roles including 11 India roles, and that same-domain first-party detail routes such as https://saucelabs.com/company/careers/7096532 and https://saucelabs.com/company/careers/7899103 were live for India openings.'

export const SAUCE_LABS_CATALOG = {
  source: 'saucelabs',
  companyName: 'Sauce Labs',
  officialBrandName: 'Sauce Labs',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'saucelabs/jobs.json',
  officialHomepageUrl: 'https://saucelabs.com/',
  companyCareerPage: 'https://saucelabs.com/careers',
  officialCareersDetailUrlBase: 'https://saucelabs.com/company/careers/',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/saucelabs',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/saucelabs/jobs?content=true',
  companyDomain: 'saucelabs.com',
  verifiedPublicRoleCount: 17,
  verifiedIndiaRoleCount: 11,
  verifiedSampleFirstPartyJobUrl: 'https://saucelabs.com/company/careers/7096532',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+browser-confirmed-greenhouse-request+greenhouse-jobs-api+india-location-filter+first-party-detail-url-pattern',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SAUCE_LABS_CATALOG
