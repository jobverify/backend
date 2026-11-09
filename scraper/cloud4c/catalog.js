import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CLOUD4C_CATALOG = {
  source: 'cloud4c',
  companyName: 'Cloud4C',
  officialBrandName: 'Cloud4C',
  adapter: 'script',
  homepageUrl: 'https://www.cloud4c.com/',
  companyCareerPage: 'https://www.cloud4c.com/careers',
  applicationFormUrl: 'https://www.cloud4c.com/applicant-form/careers',
  companyDomain: 'cloud4c.com',
  atsPlatform: 'first-party-careers-page-generic-application-form',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-generic-application-form',
  extractionStrategy:
    'verified-first-party-careers-page+generic-application-form-without-public-openings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.cloud4c.com/careers is the exact-name Cloud4C careers page, that it exposes an Apply Now CTA plus a Write to us fallback, and that the first-party application form at https://www.cloud4c.com/applicant-form/careers only asks for generic Job Title and Job Location inputs with no public opening list. Because the public surface does not expose trustworthy role inventory, this local provider remains fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cloud4c/jobs.json',
}

export default CLOUD4C_CATALOG
