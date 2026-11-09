import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TCG_DIGITAL_SOLUTIONS_CATALOG = {
  source: 'tcgdigitalsolutions',
  companyName: 'Tcg Digital Solutions',
  officialBrandName: 'TCG Digital',
  adapter: 'script',
  homepageUrl: 'https://www.tcgdigital.com/',
  companyCareerPage: 'https://www.tcgdigital.com/careers/',
  companyDomain: 'tcgdigital.com',
  atsPlatform: 'official-first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+repeating-openings-sections+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.tcgdigital.com/careers/ is the live first-party TCG Digital careers page and that it exposes repeated openings sections on-page, including India-facing roles such as AI Product Manager / Product Owner in Pune (Hybrid) and Data Science off-shore Lead – Life Sciences Domain in Pune.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TCG_DIGITAL_SOLUTIONS_CATALOG
