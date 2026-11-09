import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LIMEROAD_CATALOG = {
  source: 'limeroad',
  companyName: 'LimeRoad',
  officialBrandName: 'LimeRoad',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.limeroad.com/careers',
  homepageUrl: 'https://www.limeroad.com/',
  verifiedRoleUrls: [
    'https://www.limeroad.com/careers',
  ],
  companyDomain: 'limeroad.com',
  atsPlatform: 'official-company-site',
  countryFilter: 'India',
  paginationStrategy: 'single-static-first-party-careers-page',
  extractionStrategy: 'verified-careers-page+static-role-block',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'limeroad/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.limeroad.com/careers is a live first-party LimeRoad careers page on the official limeroad.com domain. The verified page exposes a public static role block for Department - Customer Support and Designation - Customer Support Representative, plus responsibilities, Desired Candidate Profile bullets, and Education - Any Graduate - Any Specialization on the same first-party page.',
}

export default LIMEROAD_CATALOG
