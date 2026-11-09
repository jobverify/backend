import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MYKAARMA_CATALOG = {
  source: 'mykaarma',
  companyName: 'MyKaarma',
  officialBrandName: 'myKaarma',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://mykaarma.com/',
  companyCareerPage: 'https://mykaarma.com/careers/',
  officialCareersLandingUrl: 'https://mykaarma.com/careers/',
  ripplingEmbedUrl: 'https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F',
  ripplingBoardUrl: 'https://ats.rippling.com/mykaarma/jobs',
  ripplingBoardSlug: 'mykaarma',
  atsPlatform: 'rippling',
  countryFilter: 'India',
  paginationStrategy: 'single-rippling-embed-page',
  extractionStrategy: 'verified-first-party-careers-page+rippling-embed-next-data+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mykaarma.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://mykaarma.com/careers/ is the live first-party myKaarma careers page, that it exposes the Rippling board shell with data-job-board-id="mykaarma" and the public embed at https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F, and that the live embed payload exposes an India opening for Finance and Accounting Executive in NOIDA, India.',
  dryRunFile: 'mykaarma/jobs.json',
}

export default MYKAARMA_CATALOG
