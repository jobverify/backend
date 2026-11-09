import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://nference.com/careers is the live first-party nference careers page, that its India-specific careers content hands applicants to https://nference.keka.com/careers/, and that the branded public Keka portal at https://nference.keka.com/careers/api/organization/default/careerportalinfo plus the active jobs feed at https://nference.keka.com/careers/api/embedjobs/default/active/ebcb8808-c268-4a6d-a493-192d50dde0b7 returned 3 live public jobs in Bangalore including Technical Operations Engineer at https://nference.keka.com/careers/jobdetails/78858.'

export const NFERENCE_CATALOG = {
  source: 'nference',
  companyName: 'Nference',
  officialBrandName: 'nference',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'nference/jobs.json',
  homepageUrl: 'https://nference.com/',
  companyCareerPage: 'https://nference.com/careers',
  officialCareersHandoffUrl: 'https://nference.keka.com/careers/',
  careerPortalInfoUrl: 'https://nference.keka.com/careers/api/organization/default/careerportalinfo',
  activeJobsApiUrl: 'https://nference.keka.com/careers/api/embedjobs/default/active/ebcb8808-c268-4a6d-a493-192d50dde0b7',
  verifiedSampleJobUrl: 'https://nference.keka.com/careers/jobdetails/78858',
  companyDomain: 'nference.com',
  verifiedPublicJobCount: 3,
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-careers-page+verified-keka-handoff+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  kekaIdentifier: 'ebcb8808-c268-4a6d-a493-192d50dde0b7',
  kekaDomain: 'https://nference.keka.com/careers/',
  kekaPortalName: 'default',
  kekaPortalBrand: 'Nference',
  kekaPortalDomain: 'nference.keka.com',
}

export default NFERENCE_CATALOG
