import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KIWI_TECH_CATALOG = {
  source: 'kiwitech',
  companyName: 'KiwiTech',
  officialBrandName: 'KiwiTech',
  adapter: 'script',
  homepageUrl: 'https://www.kiwitech.com/',
  companyCareerPage: 'https://www.kiwitech.com/careers',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-openings-list',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'kiwitech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.kiwitech.com/careers was the live first-party KiwiTech careers page and that it publicly listed current openings including Full Stack Lead (React / Angular + Node.js / Python) in Gurgaon / Remote / Hybrid and Associate Lead AI & ML in Noida on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'kiwitech/jobs.json',
}

export default KIWI_TECH_CATALOG
