import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IITM_RESEARCH_PARK_CATALOG = {
  source: 'iitmresearchpark',
  companyName: 'IITM Research Park',
  officialBrandName: 'IIT Madras Research Park',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://respark.iitm.ac.in/careers/',
  observedJobTitles: [
    'Electrical Engineer - Maintenance & Projects (3 Positions)',
    'Project Manager - Zoho Implementation',
    'Construction Manager - Civil',
    'Senior Manager - Legal',
    'Executive - Research Collaboration',
  ],
  observedClosingDates: [
    '2026-07-09',
    '2026-07-15',
    '2026-07-15',
    '2026-08-15',
    '2026-07-31',
  ],
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'first-party-careers-card-extraction+closing-date-live-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'respark.iitm.ac.in',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on August 2, 2026 that https://respark.iitm.ac.in/careers/ is the official IIT Madras Research Park careers page and currently shows five public job cards. Four visible cards are already past their own Valid till dates (July 09, 2026, July 15, 2026, and July 31, 2026), while Senior Manager - Legal remains live through August 15, 2026. The scraper now extracts only cards whose visible closing date is on or after the run date.',
  dryRunFile: 'iitmresearchpark/jobs.json',
}

export default IITM_RESEARCH_PARK_CATALOG
