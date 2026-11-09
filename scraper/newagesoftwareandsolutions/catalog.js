import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.newage-global.com/careers is the live first-party NewAge Software & Solutions careers page and that it publicly embeds inline role cards plus modal descriptions for openings including Product Manager - Finance with FF Domain, Enterprise Account Management - Freight Forwarding SaaS, Sales Manager, and Senior Associate. The verified India-facing roles on that exact-name page were Product Manager - Finance with FF Domain with Mumbai (Preferred) or Chennai location text and Senior Associate in Chennai, India, while all applications flow through the shared first-party /apply-now handoff.'

export const NEWAGE_SOFTWARE_AND_SOLUTIONS_CATALOG = {
  source: 'newagesoftwareandsolutions',
  companyName: 'NewAge Software & Solutions',
  officialBrandName: 'NewAge Software & Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.newage-global.com/',
  companyCareerPage: 'https://www.newage-global.com/careers',
  applicationFormUrl: 'https://www.newage-global.com/apply-now',
  companyDomain: 'newage-global.com',
  atsPlatform: 'first-party-careers-page-inline-listings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-inline-role-details',
  extractionStrategy:
    'verified-first-party-careers-page+inline-role-cards+inline-modal-role-details+shared-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'newagesoftwareandsolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NEWAGE_SOFTWARE_AND_SOLUTIONS_CATALOG
