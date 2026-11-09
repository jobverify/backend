import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COMPLERE_INFOSYSTEM_CATALOG = {
  source: 'complereinfosystem',
  companyName: 'Complere Infosystem',
  officialBrandName: 'Complere Infosystem',
  adapter: 'script',
  companyCareerPage: 'https://complereinfosystem.com/career-opportunities',
  officialCareersPageUrl: 'https://complereinfosystem.com/career-opportunities',
  companyDomain: 'complereinfosystem.com',
  atsPlatform: 'first-party-careers-page-no-structured-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+email-only-openings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://complereinfosystem.com/career-opportunities was the live first-party Complere Infosystem careers page and that it instructed candidates to send resumes to hr@complereinfosystem.com for current openings, but exposed no structured public job listings.',
  dryRunFile: 'complereinfosystem/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default COMPLERE_INFOSYSTEM_CATALOG
