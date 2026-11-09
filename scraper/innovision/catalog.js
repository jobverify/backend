import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INNOVISION_CATALOG = {
  source: 'innovision',
  companyName: 'Innovision',
  officialBrandName: 'Innovision Limited',
  adapter: 'script',
  companyCareerPage: 'https://www.innovision.co.in/careers/',
  homepageUrl: 'https://www.innovision.co.in/',
  applicationUrl: 'mailto:careers@innovision.co.in',
  companyDomain: 'innovision.co.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-inline-openings',
  extractionStrategy: 'verified-first-party-careers-page+inline-opening-cards+shared-email-apply-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'innovision/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on 2026-07-16 that the first-party careers page at https://www.innovision.co.in/careers/ exposes five visible inline openings including Security Supervisor and Training & Development Officer and uses the shared resume handoff careers@innovision.co.in.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default INNOVISION_CATALOG
