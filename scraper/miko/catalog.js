import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 16, 2026 that https://in.miko.ai/pages/careers is the live first-party Miko India careers page, that it still exposes 31 static inline cards pointing at the official Keka careers host under https://rnc.keka.com/careers/, and that the branded public Keka portal for MIKO at https://rnc.keka.com/careers/api/organization/default/careerportalinfo plus the active jobs feed at https://rnc.keka.com/careers/api/embedjobs/default/active/d7f38166-f316-43c8-bc07-256b602da7a4 returned 25 live public jobs in India including HR Operations Intern. Because several older static card links on the first-party page resolved to unavailable job postings during verification, this provider trusts the verified active Keka jobs API rather than the stale static card URLs.'

export const MIKO_CATALOG = {
  source: 'miko',
  companyName: 'Miko',
  officialBrandName: 'MIKO',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'miko/jobs.json',
  companyCareerPage: 'https://in.miko.ai/pages/careers',
  officialCareersHandoffUrl: 'https://rnc.keka.com/careers/',
  careerPortalInfoUrl: 'https://rnc.keka.com/careers/api/organization/default/careerportalinfo',
  activeJobsApiUrl: 'https://rnc.keka.com/careers/api/embedjobs/default/active/d7f38166-f316-43c8-bc07-256b602da7a4',
  verifiedSampleJobUrl: 'https://rnc.keka.com/careers/jobdetails/134690',
  companyDomain: 'miko.ai',
  verifiedFirstPartyInlineOpeningCount: 31,
  verifiedPublicJobCount: 25,
  atsPlatform: 'keka',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-single-keka-active-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-keka-careerportalinfo+active-keka-jobs-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  kekaIdentifier: 'd7f38166-f316-43c8-bc07-256b602da7a4',
  kekaDomain: 'https://rnc.keka.com/careers/',
  kekaPortalName: 'default',
  kekaPortalDomain: 'rnc.keka.com',
  expectedCompanyWebsite: 'https://miko.ai/',
}

export default MIKO_CATALOG
