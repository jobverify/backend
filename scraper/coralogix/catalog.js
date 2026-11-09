import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://coralogix.com/careers/ was the live first-party Coralogix careers page, that it publicly exposed same-domain role links under https://coralogix.com/careers/co/, and that the visible India openings on the verified date were Cloud and Observability Engineer in Gurugram, Cloud and Observability Engineer (Remote Role, 6pm - 3am) in Remote, India, and Forward Deployed Engineer in Gurugram. Verified public first-party detail pages included https://coralogix.com/careers/co/gurugram/07.C37/cloud-and-observability-engineer/all/, https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/, and https://coralogix.com/careers/co/gurugram/CE.B66/forward-deployed-engineer/all/.'

export const CORALOGIX_CATALOG = {
  source: 'coralogix',
  companyName: 'Coralogix',
  officialBrandName: 'Coralogix',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'coralogix/jobs.json',
  companyCareerPage: 'https://coralogix.com/careers/',
  companyDomain: 'coralogix.com',
  atsPlatform: 'official-first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-open-positions-page+india-detail-pages',
  extractionStrategy:
    'verified-first-party-open-positions-page+same-domain-role-links+india-location-filter+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedPublicJobCount: 3,
  verifiedSampleJobUrl:
    'https://coralogix.com/careers/co/gurugram/07.C37/cloud-and-observability-engineer/all/',
  verifiedSampleSecondaryJobUrl:
    'https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/',
  verifiedSampleTertiaryJobUrl:
    'https://coralogix.com/careers/co/gurugram/CE.B66/forward-deployed-engineer/all/',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default CORALOGIX_CATALOG
