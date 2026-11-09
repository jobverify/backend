import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const METAYB_CATALOG = {
  source: 'metayb',
  companyName: 'Metayb',
  officialBrandName: 'Metayb',
  adapter: 'script',
  homepageUrl: 'https://metayb.ai/',
  companyCareerPage: 'https://metayb.ai/',
  companyDomain: 'metayb.ai',
  atsPlatform: 'official-careers-copy-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-section-validation',
  extractionStrategy:
    'verified-first-party-careers-section+no-public-job-cards-or-ats-handoff+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://metayb.ai/ is the live first-party Metayb site, that its careers section says "Advance your career as we evolve" and "Explore Open Positions", and that the verified public surface exposes employer-brand and benefits copy but no trustworthy public job cards, public role-detail URLs, or verified ATS handoff suitable for anonymous enumeration. This local provider stays fail-closed until a stable first-party jobs surface is published.',
  dryRunFile: 'metayb/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default METAYB_CATALOG
