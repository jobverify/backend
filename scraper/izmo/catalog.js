import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IZMO_CATALOG = {
  source: 'izmo',
  companyName: 'Izmo',
  officialBrandName: 'izmocars',
  adapter: 'script',
  homepageUrl: 'https://www.goizmo.com/',
  companyCareerPage: 'https://www.goizmo.com/careers',
  atsPlatform: 'official-nextjs-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-opening-cards+same-domain-detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'goizmo.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    "Verified on Saturday, July 18, 2026 that https://www.goizmo.com/careers was the live first-party izmocars careers page, that the page banner still said Build the Future of Automotive Tech, that it exposed a Current Openings section with one visible Bangalore, India (BTM 2nd Stage) role titled Associate Graphic Designer (UK Process), and that the board handed candidates to same-domain detail links under /careers/ on the goizmo first-party domain.",
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'izmo/jobs.json',
}

export default IZMO_CATALOG
