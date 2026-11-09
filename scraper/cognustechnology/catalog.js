import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COGNUS_TECHNOLOGY_CATALOG = {
  source: 'cognustechnology',
  companyName: 'Cognus Technology',
  officialBrandName: 'Cognus Technology',
  adapter: 'script',
  homepageUrl: 'https://www.cognustechnology.com/',
  companyCareerPage: 'https://cognustechnology.zohorecruit.in/jobs/Careers',
  atsPlatform: 'zoho-recruit-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'single-hidden-input-json-payload',
  extractionStrategy: 'verified-first-party-homepage+official-zoho-careers-hidden-input-jobs-payload',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cognustechnology.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that the exact first-party Cognus Technology homepage links "Join Us" to the public Zoho Recruit board at https://cognustechnology.zohorecruit.in/jobs/Careers, and that the official careers board still exposes the trusted hidden-input jobs payload contract while rendering the "Find the career of your dreams" shell with one live "Senior Manager" opening in Jaipur.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default COGNUS_TECHNOLOGY_CATALOG
