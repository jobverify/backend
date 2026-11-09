import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.arcgate.com/careers was the live first-party Arcgate careers page and publicly listed 17 current openings across BPO and Technology, including Research Analyst, Data Engineer, and Senior Dynamics 365 Solution Architect, with each role linking to a first-party detail page and a first-party `/join?post_name=...` application flow.'

export const ARCGATE_CATALOG = {
  source: 'arcgate',
  companyName: 'ArcGate',
  officialBrandName: 'Arcgate',
  adapter: 'script',
  homepageUrl: 'https://www.arcgate.com/',
  companyCareerPage: 'https://www.arcgate.com/careers',
  verifiedSampleJobUrl: 'https://www.arcgate.com/career/data-engineer',
  verifiedSampleJobTitle: 'Data Engineer',
  companyDomain: 'arcgate.com',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-current-openings-links',
  extractionStrategy:
    'verified-first-party-careers-page+linked-detail-pages+first-party-join-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 17,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'arcgate/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ARCGATE_CATALOG
