import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FORTY_TWO_GEARS_CATALOG = {
  source: '42gears',
  companyName: '42Gears Mobility Systems',
  officialBrandName: '42Gears Mobility Systems',
  adapter: 'script',
  homepageUrl: 'https://www.42gears.com/',
  companyCareerPage: 'https://www.42gears.com/careers/?selected_jobtype=-1&selected_location=india',
  companyDomain: '42gears.com',
  atsPlatform: 'official-first-party-job-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-page-filtered-india-listing',
  extractionStrategy: 'nextjs-flight-current-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary:
    'Verified on Thursday, September 3, 2026 that https://www.42gears.com/careers/?selected_jobtype=-1&selected_location=india was the live first-party 42Gears Mobility Systems careers page, that it served its Current Openings through a Next.js flight payload, and that the public payload exposed India roles including Assistant Manager- Finance and Lead Software Engineer while still carrying out-of-scope non-India openings that this scraper filters by jobLocations.',
  dryRunFile: '42gears/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FORTY_TWO_GEARS_CATALOG
