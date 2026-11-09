import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that https://www.kapture.cx/careers/ remains the live first-party ' +
  'Kapture CRM careers page and that it still hands off to the public Keka embed contract on ' +
  'kapturecrm.keka.com using identifier 30315393-d861-4cad-851c-03e99c4fe979 for 40 active India job listings.'

export const KAPTURE_CRM_CATALOG = {
  source: 'kapturecrm',
  companyName: 'Kapture CRM',
  officialBrandName: 'Kapture',
  adapter: 'script',
  dryRunFile: 'kapturecrm/jobs.json',
  companyCareerPage: 'https://www.kapture.cx/careers/',
  embedConfigUrl: 'https://kapturecrm.keka.com/careers/api/embedjobs/js/30315393-d861-4cad-851c-03e99c4fe979',
  activeJobsUrl: 'https://kapturecrm.keka.com/careers/api/embedjobs/default/active/30315393-d861-4cad-851c-03e99c4fe979',
  departmentsUrl: 'https://kapturecrm.keka.com/careers/api/embedjobs/departments/30315393-d861-4cad-851c-03e99c4fe979',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-kapture-crm-careers-page+verified-keka-embed-config+active-keka-embed-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'kapture.cx',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default KAPTURE_CRM_CATALOG
