import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.healthasyst.com/careers/ is the live first-party HealthAsyst careers page, that it explicitly says "Check out the open positions" and links candidates via "Click here" to the public Keka board at https://healthasyst.keka.com/careers/, and that the board exposes the public Keka identity payload at https://healthasyst.keka.com/careers/api/organization/default/careerportalinfo together with the live jobs feed at https://healthasyst.keka.com/careers/api/jobs/default/active. This provider therefore uses the trusted first-party homepage handoff plus the public Keka jobs API.'

export const HEALTHASYST_CATALOG = {
  source: 'healthasyst',
  companyName: 'HealthAsyst',
  officialBrandName: 'HealthAsyst',
  adapter: 'script',
  homepageUrl: 'https://www.healthasyst.com/',
  companyCareerPage: 'https://www.healthasyst.com/careers/',
  officialKekaBoardUrl: 'https://healthasyst.keka.com/careers/',
  publicJobsApiUrl: 'https://healthasyst.keka.com/careers/api/jobs/default/active',
  companyDomain: 'healthasyst.com',
  atsPlatform: 'keka-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-handoff-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-official-careers-page+verified-keka-handoff+careerportalinfo+active-keka-jobs-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'healthasyst/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HEALTHASYST_CATALOG
