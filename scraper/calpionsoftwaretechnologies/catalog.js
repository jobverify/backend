import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CALPION_SOFTWARE_TECHNOLOGIES_CATALOG = {
  source: 'calpionsoftwaretechnologies',
  companyName: 'Calpion Software Technologies',
  officialBrandName: 'Calpion',
  adapter: 'script',
  homepageUrl: 'https://www.calpion.com/',
  companyCareerPage: 'https://www.calpion.com/career',
  officialCareersPageUrl: 'https://www.calpion.com/career',
  companyDomain: 'calpion.com',
  atsPlatform: 'official-first-party-career-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-career-page',
  extractionStrategy: 'webflow-career-card-listing-plus-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://www.calpion.com/career was the live first-party Calpion careers page, that it publicly exposed Webflow career cards with Apply Now links for roles including Lead - Full Stack Software Developer, AI/ML Developer, and Quality Manager Medical Coding, and that the linked first-party detail pages still exposed structured role metadata such as job title and Bengaluru/Bangalore locations.',
  dryRunFile: 'calpionsoftwaretechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CALPION_SOFTWARE_TECHNOLOGIES_CATALOG
