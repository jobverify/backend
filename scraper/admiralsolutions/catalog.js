import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ADMIRAL_SOLUTIONS_CATALOG = {
  source: 'admiralsolutions',
  companyName: 'Admiral Solutions',
  officialBrandName: 'Admiral Solutions',
  adapter: 'script',
  companyCareerPage: 'https://career.admiralsolutions.in/vacancies/',
  companyDomain: 'career.admiralsolutions.in',
  homepageUrl: 'https://www.admiralsolutions.in/',
  atsPlatform: 'official-company-careers-portal',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-vacancies-page',
  extractionStrategy: 'verified-homepage-handoff+verified-vacancies-list+first-party-detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that Admiral Solutions used the first-party careers portal at https://career.admiralsolutions.in/vacancies/, and that page exposed Gurugram openings including Customer Care Specialist, People Partner Executive, Assistant Manager - Risk & Compliance, Executive Payroll & Compliance, and Analyst - MI with first-party detail routes.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ADMIRAL_SOLUTIONS_CATALOG
