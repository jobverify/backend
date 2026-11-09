import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHVED_CONSULTING_CATALOG = {
  source: 'techvedconsulting',
  companyName: 'Techved Consulting',
  officialBrandName: 'TECHVED Consulting India Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.techved.com/',
  companyCareerPage: 'https://www.techved.com/me/career',
  companyDomain: 'techved.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-aspnet-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-job-cards+same-page-detail-panels',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.techved.com/me/career remained the live first-party TECHVED careers page, exposed an All Jobs category list, and rendered same-page opening cards with inline detail panels for India roles including Sr Marketing Associate, Inside Sales Executive, and UX Designer in Goregaon(E), Mumbai.',
  dryRunFile: 'techvedconsulting/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TECHVED_CONSULTING_CATALOG
