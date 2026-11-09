import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AUZMOR_CATALOG = {
  source: 'auzmor',
  companyName: 'Auzmor',
  officialBrandName: 'Auzmor',
  adapter: 'script',
  companyCareerPage: 'https://auzmor.com/careers/',
  homepageUrl: 'https://auzmor.com/',
  careersPageUrl: 'https://auzmor.com/careers/',
  pageSitemapUrl: 'https://auzmor.com/page-sitemap.xml',
  sitemapCareerRouteUrls: ['https://auzmor.com/careers/'],
  careerAliasRouteUrls: ['https://auzmor.com/career'],
  noPublicJobRouteUrls: [
    'https://auzmor.com/jobs',
    'https://auzmor.com/join-us',
    'https://auzmor.com/work-with-us',
    'https://auzmor.com/openings',
    'https://auzmor.com/current-openings',
    'https://auzmor.com/company/careers',
    'https://auzmor.com/about/careers',
  ],
  atsPlatform: 'auzmor-hire',
  countryFilter: 'India',
  paginationStrategy: 'native-grouped-pagination-filter-counts-and-closing-inventory',
  extractionStrategy:
    'corporate-published-auzmor-hire-widget+native-employer+grouped-pagination-and-filter-counts+India-full-details+closing-inventory',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'auzmor.com',
  verifiedOn: '2026-11-02',
  verifiedSurfaceSummary:
    'Verified on November 2, 2026 that https://auzmor.com/ links Careers to https://auzmor.com/careers/, which publishes the same-company Auzmor Hire widget, tenant auzmor, https://hire.auzmor.com/ and https://hire.api.auzmor.com/api/v1/. Native organization identity binds Auzmor.com; grouped pagination and independent department/location filter counts reconcile the public inventory. Native role location objects preserve the country behind Remote display labels. Full India job criteria and closing native inventory are validated without substituting current dates or job content.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AUZMOR_CATALOG
