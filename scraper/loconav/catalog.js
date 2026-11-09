import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LOCONAV_CATALOG = {
  source: 'loconav',
  companyName: 'Loconav',
  officialBrandName: 'LocoNav',
  adapter: 'script',
  homepageUrl: 'https://loconav.com/',
  companyCareerPage: 'https://loconav.com/career',
  companyDomain: 'loconav.com',
  atsPlatform: 'first-party-careers-page-linkedin-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+linkedin-handoff-without-first-party-job-list+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://loconav.com/career remained the live first-party LocoNav careers page, but its only job-action surface was a "See Job Openings" handoff to LinkedIn. The verified first-party page exposed culture copy and contact addresses but no first-party public jobs inventory, so this provider stays fail-closed until LocoNav exposes openings directly on a trusted first-party surface.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'loconav/jobs.json',
}

export default LOCONAV_CATALOG
