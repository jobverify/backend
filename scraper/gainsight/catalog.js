import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://www.gainsight.com/company/careers/?gsfrom=staircase is the live first-party Gainsight careers page and that it prominently says "Find Authentic Jobs", while the first-party Jibe shell at https://careers.gainsight.com/jobs/brands currently renders an empty search surface with the Gainsight Jibe identifier, a search-results-none container, and a "Join Our Talent Community" CTA instead of enumerable public job cards. The companion first-party locations page at https://careers.gainsight.com/jobs/locations also reports "No cities" and "No country". This provider therefore stays conservative and returns an empty set until the verified first-party Jibe shell exposes public jobs or a stable public jobs API can be confirmed.'

export const GAINSIGHT_CATALOG = {
  source: 'gainsight',
  companyName: 'Gainsight',
  officialBrandName: 'Gainsight',
  adapter: 'script',
  homepageUrl: 'https://www.gainsight.com/',
  companyCareerPage: 'https://www.gainsight.com/company/careers/?gsfrom=staircase',
  officialJobsShellUrl: 'https://careers.gainsight.com/jobs/brands',
  officialLocationsUrl: 'https://careers.gainsight.com/jobs/locations',
  companyDomain: 'gainsight.com',
  atsPlatform: 'first-party-jibe-empty-shell',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-empty-jibe-shell-validation',
  extractionStrategy:
    'verified-first-party-careers-page+verified-empty-jibe-shell+verified-empty-locations-page+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'gainsight/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GAINSIGHT_CATALOG
