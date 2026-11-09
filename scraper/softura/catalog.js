import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOFTURA_CATALOG = {
  source: 'softura',
  companyName: 'Softura',
  officialBrandName: 'Softura',
  adapter: 'script',
  homepageUrl: 'https://www.softura.com/',
  companyCareerPage: 'https://www.softura.com/careers/',
  companyDomain: 'softura.com',
  atsPlatform: 'first-party-inline-job-listings-plus-zoho-links',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-india-location-groups+zoho-linked-india-rows',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    'Verified on Sunday, September 13, 2026 that https://www.softura.com/careers/ publicly lists 33 distinct India job rows across its linked Zoho group and Chennai, Ahmedabad, Pune, and Coimbatore sections. The scraper now reads those complete same-page rows directly because sequential first-party detail requests trigger Cloudflare HTTP 429 responses; apply URLs remain the listed first-party or Softura Zoho Recruit links.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'softura/jobs.json',
}

export default SOFTURA_CATALOG
