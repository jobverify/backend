import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VSERVE_EBUSINESS_SOLUTIONS_CATALOG = {
  source: 'vserveebusinesssolutions',
  companyName: 'Vserve Ebusiness Solutions',
  officialBrandName: 'Vserve eBusiness Solutions',
  adapter: 'script',
  homepageUrl: 'https://vservesolution.com/',
  companyCareerPage: 'https://vservesolution.com/careers/',
  companyDomain: 'vservesolution.com',
  atsPlatform: 'first-party-careers-page-plus-embedded-zoho-recruit-portal',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-embedded-zoho-job-table',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-zoho-job-table+detail-pages+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-06',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 6, 2026 that https://vservesolution.com/careers/ is the live Vserve eBusiness Solutions careers page, that it embeds the public Zoho Recruit portal at recruit.zoho.com, and that the portal publicly lists roles including Senior Full Stack Developer, Technical Project Manager, and Quality Controller while also exposing non-India rows such as Pasig that are excluded by the India filter. This provider now extracts detail pages from the embedded Zoho job table.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'vserveebusinesssolutions/jobs.json',
}

export default VSERVE_EBUSINESS_SOLUTIONS_CATALOG
