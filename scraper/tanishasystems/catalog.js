import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TANISHA_SYSTEMS_CATALOG = {
  source: 'tanishasystems',
  companyName: 'Tanisha Systems',
  officialBrandName: 'Tanisha Systems Inc.',
  adapter: 'script',
  companyCareerPage: 'https://www.tanishasystems.com/currentopenings.html',
  companyDomain: 'tanishasystems.com',
  atsPlatform: 'first-party-static-openings-page',
  countryFilter: 'United States',
  paginationStrategy: 'single-first-party-openings-page',
  extractionStrategy: 'verified-first-party-static-openings-page+inline-opening-blocks',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.tanishasystems.com/currentopenings.html was still the live first-party Tanisha Systems current openings page and that it publicly rendered inline opening blocks including Software Developer, Project Manager, Business Analyst, Software Engineer, and Industrial Cybersecurity Engineer along with location and opening-count details on the page.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'tanishasystems/jobs.json',
}

export default TANISHA_SYSTEMS_CATALOG
