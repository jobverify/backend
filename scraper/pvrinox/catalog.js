import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PVR_INOX_CATALOG = {
  source: 'pvrinox',
  companyName: 'PVR INOX',
  officialBrandName: 'PVR INOX',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.pvrcinemas.com/',
  companyCareerPage: 'https://www.pvrcinemas.com/careers-us',
  careerRouteUrls: [
    'https://www.pvrcinemas.com/careers-us',
    'https://www.pvrcinemas.com/career',
    'https://www.pvrcinemas.com/careers',
  ],
  companyDomain: 'pvrcinemas.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-routes-plus-generic-spa-shell-validation',
  extractionStrategy:
    'verified-careers-us-route+verified-parallel-career-routes-return-generic-movie-booking-spa-shell+no-public-jobs-markers',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'pvrinox/jobs.json',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.pvrcinemas.com/careers-us, https://www.pvrcinemas.com/career, and https://www.pvrcinemas.com/careers each returned the same generic movie-booking SPA shell for PVR INOX Cinemas rather than a trustworthy public jobs board. The returned static HTML kept the consumer movie-ticket metadata, including the Book Movie Tickets Online | PVR INOX Cinemas Open Graph surface and og:url pointing at https://www.inoxmovies.com/, while exposing no JobPosting markup, no ATS handoff, and no public job-card markers. Live bundle inspection also confirmed a client route string for careers-us but no trustworthy public jobs surface.',
}

export default PVR_INOX_CATALOG
