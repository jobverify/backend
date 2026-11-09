import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STRATEGIC_ERP_CATALOG = {
  source: 'strategicerp',
  companyName: 'StrategicERP',
  officialBrandName: 'StrategicERP',
  adapter: 'script',
  homepageUrl: 'https://www.strategicerp.com/',
  companyCareerPage: 'https://www.strategicerp.com/careers.php',
  companyDomain: 'strategicerp.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-current-positions-page+visible-position-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.strategicerp.com/careers.php is the live first-party StrategicERP careers page and that it publicly exposes Current Positions-style cards with Apply Now links to first-party detail routes such as job_details.php?id=3. The verified page showed visible role cards with title, employment type, experience, and Mumbai location data, so this local provider scrapes the first-party listing page directly.',
  dryRunFile: 'strategicerp/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default STRATEGIC_ERP_CATALOG
