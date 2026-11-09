import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.taazaa.com/about-us/careers is the live first-party Taazaa careers page, that it exposes "Current Openings" and "View All Openings", and that its embedded Keka configuration points to https://taazaa.keka.com/careers/ with identifier caf439a8-817a-46f5-917f-c6aef6ab6beb. Public first-party Keka verification also exposed the exact company identity at https://taazaa.keka.com/careers/api/organization/default/careerportalinfo and the live jobs feed at https://taazaa.keka.com/careers/api/jobs/default/active, so this provider uses the trusted first-party embed handoff plus the public Keka jobs API.'

export const TAAZAA_CATALOG = {
  source: 'taazaa',
  companyName: 'TAAZAA',
  officialBrandName: 'Taazaa',
  adapter: 'script',
  homepageUrl: 'https://www.taazaa.com/',
  companyCareerPage: 'https://www.taazaa.com/about-us/careers',
  officialKekaBoardUrl: 'https://taazaa.keka.com/careers/',
  publicJobsApiUrl: 'https://taazaa.keka.com/careers/api/jobs/default/active',
  expectedIdentifier: 'caf439a8-817a-46f5-917f-c6aef6ab6beb',
  companyDomain: 'taazaa.com',
  atsPlatform: 'keka-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'official-first-party-page-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-page+verified-embedded-keka-config+careerportalinfo+active-keka-jobs-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'taazaa/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TAAZAA_CATALOG
