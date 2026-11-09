import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LEPTON_SOFTWARE_EXPORT_RESEARCH_CATALOG = {
  source: 'leptonsoftwareexportresearch',
  companyName: 'Lepton Software Export & Research',
  officialBrandName: 'Lepton Software',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://leptonsoftware.com/career/',
  companyDomain: 'leptonsoftware.com',
  jobsApiUrl: 'https://leptonsoftware.keka.com/careers/api/jobs/default/active',
  atsPlatform: 'keka-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'single-keka-public-jobs-request',
  extractionStrategy: 'verified-first-party-careers-page+public-keka-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    "Verified on Sunday, August 2, 2026 that https://leptonsoftware.com/career/ remains the live first-party Lepton careers page, now rendering visible Keka-backed role cards and jobdetails links while the public Keka endpoint https://leptonsoftware.keka.com/careers/api/jobs/default/active remains live. Same-day verification confirmed current India openings including Account Executive - New Business and QA Engineer (QA 2).",
}

export default LEPTON_SOFTWARE_EXPORT_RESEARCH_CATALOG
