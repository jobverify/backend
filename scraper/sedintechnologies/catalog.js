import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SEDIN_TECHNOLOGIES_CATALOG = {
  source: 'sedintechnologies',
  companyName: 'Sedin Technologies',
  officialBrandName: 'Sedin Technologies',
  adapter: 'script',
  homepageUrl: 'https://sedintechnologies.com/',
  companyCareerPage: 'https://sedintechnologies.com/career/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-job-cards+third-party-zoho-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sedintechnologies.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://sedintechnologies.com/career/ remained Sedin Technologies\' first-party careers page, exposed Current Opportunities cards such as Odoo Pre Sales and Lead Polyglot Developer, and handed apply actions to public Zoho Recruit detail URLs.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SEDIN_TECHNOLOGIES_CATALOG
