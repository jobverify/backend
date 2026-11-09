import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NETHUES_TECHNOLOGIES_CATALOG = {
  source: 'nethuestechnologies',
  companyName: 'Nethues Technologies',
  officialBrandName: 'Nethues Technologies',
  adapter: 'script',
  companyCareerPage: 'https://www.nethues.com/careers/',
  companyDomain: 'nethues.com',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-inline-sections',
  extractionStrategy: 'verified-careers-page+openings-list+inline-job-details+first-party-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that Nethues Technologies used the first-party careers page at https://www.nethues.com/careers/, and that page exposed public Rohini openings with inline detailed sections for Full Stack Developer, Golang Developer, Wordpress Developer, Chat Support Executive, and Telesales Executive.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NETHUES_TECHNOLOGIES_CATALOG
