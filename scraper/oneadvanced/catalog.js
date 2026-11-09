import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ONEADVANCED_CATALOG = {
  source: 'oneadvanced',
  companyName: 'OneAdvanced',
  officialBrandName: 'OneAdvanced',
  adapter: 'script',
  homepageUrl: 'https://www.oneadvanced.com/',
  companyCareerPage: 'https://careers.oneadvanced.com/',
  searchPageUrl: 'https://careers-oneadvanced.icims.com/jobs/search?ss=1&in_iframe=1',
  atsPlatform: 'icims',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-shell-plus-icims-search-pages',
  extractionStrategy: 'verified-careers-shell+verified-icims-search-page+india-job-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'careers.oneadvanced.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://careers.oneadvanced.com/ is the live official OneAdvanced careers shell, that it hands candidates to the public iCIMS portal at https://careers-oneadvanced.icims.com/, and that the public search page at https://careers-oneadvanced.icims.com/jobs/search?ss=1&in_iframe=1 exposes India listings including Bengaluru detail pages.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ONEADVANCED_CATALOG
