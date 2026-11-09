import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BLUCOGNITION_CATALOG = {
  source: 'blucognition',
  companyName: 'bluCognition',
  officialBrandName: 'bluCognition',
  adapter: 'script',
  homepageUrl: 'https://www.blucognition.com/',
  companyCareerPage: 'https://www.blucognition.com/careers/',
  jobsApiUrl: 'https://www.blucognition.com/careers.txt',
  atsPlatform: 'first-party-json-feed',
  countryFilter: 'India',
  paginationStrategy: 'single-json-feed',
  extractionStrategy: 'verified-first-party-careers-page+first-party-careers-json-feed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'blucognition.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.blucognition.com/careers/ remained the exact first-party bluCognition careers page and that its first-party JSON feed at https://www.blucognition.com/careers.txt exposed active openings including Analyst - AML & KYC, Intern - Software Engineer, and Analyst - Marketing Analyst across Pune, Jaipur, and Remote locations.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BLUCOGNITION_CATALOG
