import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APPVENTUREZ_CATALOG = {
  source: 'appventurez',
  companyName: 'Appventurez',
  officialBrandName: 'Appventurez',
  adapter: 'script',
  homepageUrl: 'https://www.appventurez.com/',
  companyCareerPage: 'https://www.appventurez.com/careers',
  sharedApplyFormUrl: 'https://www.appventurez.com/careers#career_form',
  companyDomain: 'appventurez.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-role-cards+shared-apply-form-anchor',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.appventurez.com/careers is the live first-party Appventurez careers page. The verified surface exposes a Current Openings section with public role cards, all Apply Now buttons point to the shared first-party anchor https://www.appventurez.com/careers#career_form, and the page visibly publishes jobs@appventurez.com together with careers@appventurez.com for applicant handoff.',
  dryRunFile: 'appventurez/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default APPVENTUREZ_CATALOG
