import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ATIDIV_CATALOG = {
  source: 'atidiv',
  companyName: 'Atidiv',
  officialBrandName: 'Atidiv',
  adapter: 'script',
  homepageUrl: 'https://atidiv.com/',
  companyCareerPage: 'https://atidiv.com/careers/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-static-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+static-current-openings-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'atidiv.com',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://www.atidiv.com/careers/ redirects to the official https://atidiv.com/careers/ page, whose Current Openings section links to https://atidiv.com/job/senior-campaign-manager/ with Digital Marketing, Full-Time, Growth, and Remote tags.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ATIDIV_CATALOG
