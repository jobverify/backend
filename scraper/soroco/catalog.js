import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOROCO_CATALOG = {
  source: 'soroco',
  companyName: 'Soroco',
  officialBrandName: 'Soroco',
  adapter: 'script',
  homepageUrl: 'https://soroco.com/',
  companyCareerPage: 'https://soroco.com/careers/',
  allOpeningsUrl: 'https://soroco.com/all-job-openings/',
  embeddedGreenhouseApiUrl: 'https://boards-api.greenhouse.io/v1/boards/soroco/jobs?content=true',
  companyDomain: 'soroco.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-role-cards',
  extractionStrategy:
    'verified-first-party-careers-page+visible-role-card-html+fallback-all-openings-link',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 1,
  verifiedIndiaJobCount: 1,
  verifiedSampleJobUrl: 'https://soroco.com/all-job-openings/',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026: https://soroco.com/careers/ resolved with the public Grow with Soroco careers page, a visible Account Based Marketing Manager role card in Bangalore, and a first-party View all openings link to https://soroco.com/all-job-openings/. The embedded Greenhouse API reference returned 0 jobs, so this local scraper trusts the visible first-party role card HTML instead of the empty third-party feed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SOROCO_CATALOG
