import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HAPPYFOX_CATALOG = {
  source: 'happyfox',
  companyName: 'HappyFox',
  officialBrandName: 'HappyFox',
  adapter: 'script',
  companyCareerPage: 'https://www.happyfox.com/jobs/',
  companyDomain: 'happyfox.com',
  atsPlatform: 'first-party-astro-careers',
  countryFilter: 'India',
  paginationStrategy: 'regional-job-pages+verified-local-filters+closing-reconciliation',
  extractionStrategy: 'explicit-corporate-country-scope+native-role-identity+full-current-detail-content',
  zeroResultPolicy: 'evidence-required',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialJobsHubUrl: 'https://www.happyfox.com/jobs/',
  indiaCityPageUrls: [
    'https://www.happyfox.com/jobs/chennai/',
    'https://www.happyfox.com/jobs/bengaluru/',
    'https://www.happyfox.com/jobs/hyderabad/',
  ],
  nativeJobsHost: 'https://hiring.happyfox.co',
  legacyTrakstarJobsHost: 'https://happyfox.hire.trakstar.com',
  verifiedOn: '2026-10-26',
  verifiedSurfaceSummary:
    'Current https://www.happyfox.com/jobs/ explicitly separates India and USA entry routes. Astro regional pages expose finite role counts and a verified local filtering client, with native details on https://hiring.happyfox.co. Runtime validates employer, title, assigned city, department and native application identity, preserves full role-owned content, and reconciles closing country/city/card sets before caps. Original job publication dates remain unknown. Additional recruiting scope, missing details or changing inventories retain partial evidence and disable cleanup; Trakstar is a historical archive host only.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default HAPPYFOX_CATALOG
