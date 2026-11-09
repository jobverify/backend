import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NEXDIGM_CATALOG = {
  source: 'nexdigm',
  companyName: 'Nexdigm',
  officialBrandName: 'Nexdigm',
  adapter: 'script',
  officialHomepageUrl: 'https://www.nexdigm.com/',
  companyCareerPage: 'https://www.nexdigm.com/careers/',
  officialCurrentOpeningsUrl: 'https://www.nexdigm.com/careers/current-openings/',
  officialCurrentOpeningsDataUrl: 'https://www.nexdigm.com/joblist.php',
  reviewedUpstreamErrorValue: 'error code: 502',
  companyDomain: 'nexdigm.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-first-party-careers-page-plus-inline-current-openings-cards-single-page',
  extractionStrategy:
    'verified-careers-page+verified-current-openings-shell+inline-card-parser+darwinbox-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'nexdigm/jobs.json',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.nexdigm.com/careers/ remained the live official Nexdigm careers page with the title "Nexdigm | Explore Career Opportunities" and still handed off to https://www.nexdigm.com/careers/current-openings/. The linked first-party current-openings surface now exposes inline public job cards, public detail links at https://www.nexdigm.com/career-details?id=..., and Darwinbox apply handoffs, so the scraper now parses the visible cards directly while preserving the reviewed hidden-arr upstream-error fallback value "error code: 502" for true empty states.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NEXDIGM_CATALOG
