import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMART_SOFTWARE_SERVICES_CATALOG = {
  source: 'smartsoftwareservices',
  companyName: 'Smart Software Services(I)',
  officialBrandName: 'Smart Software Services',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://smartsoftwareservices.com/',
  companyCareerPage: 'https://smartsoftwareservices.com/careers',
  atsPlatform: 'first-party-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-visible-role-cards',
  extractionStrategy: 'verified-first-party-role-cards+in-page-application-modal',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'smartsoftwareservices.com',
  dryRunFile: 'smartsoftwareservices/jobs.json',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that https://smartsoftwareservices.com/careers was the live first-party Smart Software Services careers page, that it rendered 4 open roles as visible role cards, that those cards included QA Automation Engineer, Frontend Developer (React / Next.js), Backend Developer (Node.js), and UI/UX Designer, and that candidate applications opened through an in-page application modal on the same first-party careers surface.',
}

export default SMART_SOFTWARE_SERVICES_CATALOG
