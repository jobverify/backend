import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EXCELRA_KNOWLEDGE_SOLUTIONS_CATALOG = {
  source: 'excelraknowledgesolutions',
  companyName: 'Excelra Knowledge Solutions',
  officialBrandName: 'Excelra',
  adapter: 'script',
  homepageUrl: 'https://www.excelra.com/',
  companyCareerPage: 'https://www.excelra.com/careers/',
  careersWordpressApiUrl: 'https://www.excelra.com/wp-json/wp/v2/pages?slug=careers',
  careersJobsApiUrl: 'https://www.excelra.com/wp-json/wp/v2/job_listing',
  careersPortalBaseUrl: 'https://excelra.darwinbox.in/ms/candidatev2/main/careers/',
  companyDomain: 'excelra.com',
  atsPlatform: 'first-party-wordpress-rendered-darwinbox-job-links',
  countryFilter: 'India',
  paginationStrategy: 'wordpress-careers-record-plus-rendered-shortcode-or-paginated-job-listings',
  extractionStrategy:
    'verified-wordpress-careers-page+rendered-darwinbox-cards-or-public-job-listings+complete-pagination+official-applications+explicit-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-19',
  verifiedSurfaceSummary:
    'Verified October 19, 2026: the published careers WordPress record now uses a darwinbox_jobs shortcode, with historical static cards disabled. The rendered page and public /wp-json/wp/v2/job_listing endpoint contain the same fourteen current Darwinbox IDs: eight India, five United States, and one Belgium. If Cloudflare blocks rendered HTML, the scraper exhausts the public job-listing endpoint in pages of 100, validates published job types and open status, exact official application IDs, and explicit country scope. Empty, malformed, duplicated, or interrupted snapshots remain errors.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'excelraknowledgesolutions/jobs.json',
}

export default EXCELRA_KNOWLEDGE_SOLUTIONS_CATALOG
