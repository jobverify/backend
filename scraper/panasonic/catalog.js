import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PANASONIC_CATALOG = {
  source: 'panasonic',
  companyName: 'Panasonic',
  officialBrandName: 'Panasonic',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://careers.na.panasonic.com/corporate/jobs/locations/country/India',
  officialIndiaCorporatePageUrl: 'https://www.panasonic.com/in/corporate.html',
  officialGlobalCareersUrl: 'https://careers.na.panasonic.com/',
  officialCorporateCareersUrl: 'https://careers.na.panasonic.com/corporate',
  officialLocationsUrl: 'https://careers.na.panasonic.com/corporate/jobs/locations',
  officialJobsApiUrl: 'https://careers.na.panasonic.com/api/jobs',
  companyDomain: 'careers.na.panasonic.com',
  atsPlatform: 'jibe-icims-api',
  countryFilter: 'India',
  paginationStrategy: 'public-api-page-parameter',
  extractionStrategy:
    'verified-panasonic-india-corporate-handoff+verified-corporate-india-route+public-jibe-api-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that the official Panasonic India corporate page at https://www.panasonic.com/in/corporate.html exposes Careers[Global site], that Panasonic\'s official corporate careers surface at https://careers.na.panasonic.com/corporate/jobs/locations lists India and the India route at https://careers.na.panasonic.com/corporate/jobs/locations/country/India still exposes country=India through window.searchConfig, and that the first-party public Jibe API at https://careers.na.panasonic.com/api/jobs returned 21 India jobs including Line Maintenance Manager - India and Software Engineer III - Fullstack + Kubernetes + Devops.',
  dryRunFile: 'panasonic/jobs.json',
}

export default PANASONIC_CATALOG
