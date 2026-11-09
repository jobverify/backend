import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NUCSOFT_CATALOG = {
  source: 'nucsoft',
  companyName: 'Nucsoft',
  officialBrandName: 'NUCSOFT',
  adapter: 'script',
  homepageUrl: 'https://nucsoft.com/',
  companyCareerPage: 'https://nucsoft.com/career-base',
  openingsPageUrl: 'https://nucsoft.com/openings',
  applicationFormUrl: 'https://nucsoft.com/application-form',
  companyDomain: 'nucsoft.com',
  atsPlatform: 'first-party-careers-page-opening-links',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-carousel',
  extractionStrategy:
    'verified-first-party-careers-page+visible-opening-cards+opening-query-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://nucsoft.com/career-base was the live exact-name NUCSOFT careers page, that it exposed visible opening cards including Flutter Developer, UI/UX Designer, Python Developer, .NET Full Stack Dev, and DBA/SQL Developer, and that each card linked to a first-party opening route under https://nucsoft.com/openings?job=... with applications ultimately routed to the first-party NUCSOFT application form.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'nucsoft/jobs.json',
}

export default NUCSOFT_CATALOG
