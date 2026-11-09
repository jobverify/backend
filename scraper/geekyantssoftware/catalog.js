import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GEEKYANTS_SOFTWARE_CATALOG = {
  source: 'geekyantssoftware',
  companyName: 'Geekyants Software',
  officialBrandName: 'GeekyAnts',
  adapter: 'script',
  homepageUrl: 'https://geekyants.com/en-in',
  companyCareerPage: 'https://geekyants.com/en-in/join-geekyants',
  companyJobsHost: 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings',
  topgeekCompanySlug: 'geekyants-india-pvt-ltd',
  atsPlatform: 'first-party-careers-page-plus-topgeek-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-join-page-plus-topgeek-detail-pages',
  extractionStrategy: 'verified-first-party-join-page+public-topgeek-opening-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'geekyants.com',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 8,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the first-party GeekyAnts India join page at https://geekyants.com/en-in/join-geekyants rendered "Showing 8 results" and publicly listed openings including Senior Backend Engineer, Senior Software Engineer -I (AI/ML), Senior Business Analyst - US Healthcare & Interoperability, Governance Support Officer, Tech Lead - Java Spring Boot, Tech Lead- Go-lang, Golang Developer, and Legal Associate. Those first-party cards linked to public detail pages under topgeek.io for GeekyAnts India Pvt Ltd, so this local scraper uses the verified join page plus topgeek detail routes.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'geekyantssoftware/jobs.json',
}

export default GEEKYANTS_SOFTWARE_CATALOG
