import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRISTYN_CARE_CATALOG = {
  source: 'pristyncare',
  companyName: 'Pristyn Care',
  officialBrandName: 'Pristyn Care',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pristyncare/jobs.json',
  companyCareerPage: 'https://www.pristyncare.com/company/careers/',
  officialJobsHandoffUrl: 'https://pristyncare.skillate.com/',
  officialFeaturedJobsContainerClass: 'featuredPositionsJobsContainer',
  companyDomain: 'pristyncare.com',
  atsPlatform: 'official-careers-page-plus-unreachable-skillate-handoff',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-validation-plus-skillate-connectivity-check',
  extractionStrategy:
    'verified-first-party-careers-page+empty-featured-positions-shell+unreachable-skillate-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.pristyncare.com/company/careers/ is the live official Pristyn Care careers page, that its Featured Positions shell leaves the featuredPositionsJobsContainer empty on the first-party page, and that its only public jobs handoff is the VIEW ALL JOBS link to https://pristyncare.skillate.com/. Direct live checks of that Skillate board failed with connection errors such as "fetch failed" and "Could not connect to server", so no trustworthy public jobs surface was reachable on the verified date.',
}

export default PRISTYN_CARE_CATALOG
