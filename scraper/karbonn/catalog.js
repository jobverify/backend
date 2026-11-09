import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KARBONN_CATALOG = {
  source: 'karbonn',
  companyName: 'Karbonn',
  officialBrandName: 'karbonn',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://karbonn.in/?page_id=944',
  homepageUrl: 'https://www.karbonnmobiles.com/',
  staleCareerRouteUrl: 'https://www.karbonnmobiles.com/careers.html?view=apply',
  companyDomain: 'karbonn.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-homepage-careers-link-plus-subscribe-only-careers-page-plus-stale-route-validation',
  extractionStrategy:
    'verified-homepage-careers-link+verified-subscribe-only-careers-page+verified-stale-careers-route-404',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'karbonn/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that the live official Karbonn homepage at https://www.karbonnmobiles.com/ links its first-party careers surface to https://karbonn.in/?page_id=944, but that careers page only exposes a subscribe-style Elementor form with the placeholder ENTER YOUR EMAIL and no public job cards, role titles, ATS feed, or JobPosting records. Also verified that the stale first-party route https://www.karbonnmobiles.com/careers.html?view=apply currently returns a 404. There is no trustworthy public jobs surface to scrape.',
}

export default KARBONN_CATALOG
