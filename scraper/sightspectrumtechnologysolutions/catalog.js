import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG = {
  source: 'sightspectrumtechnologysolutions',
  companyName: 'SightSpectrum Technology Solutions',
  officialBrandName: 'SightSpectrum',
  adapter: 'script',
  homepageUrl: 'https://www.sightspectrum.com/',
  companyCareerPage: 'https://www.sightspectrum.com/careers',
  companyDomain: 'sightspectrum.com',
  atsPlatform: 'official-first-party-job-sections',
  countryFilter: 'India',
  paginationStrategy: 'single-page-open-roles',
  extractionStrategy: 'first-party-inline-job-sections',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.sightspectrum.com/careers was the live first-party SightSpectrum careers page and that the page publicly exposed inline openings including Data Engineer and UI/UX Designer on the verified date.',
  dryRunFile: 'sightspectrumtechnologysolutions/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG
