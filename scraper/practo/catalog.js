import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRACTO_CATALOG = {
  source: 'practo',
  companyName: 'Practo',
  officialBrandName: 'Practo',
  adapter: 'script',
  homepageUrl: 'https://www.practo.com/',
  companyCareerPage: 'https://careers.practo.com/practo/',
  companyDomain: 'practo.com',
  atsPlatform: 'zwayam-public-search',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-shell-plus-zwayam-search-pagination',
  extractionStrategy: 'verified-careers-shell+zwayam-search+zwayam-jobs-service-detail',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialSearchApiUrl: 'https://public.zwayam.com/jobs/search',
  zwayamCompanyId: 'MTYzMDI=',
  zwayamDetailCompanyId: '16302',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://careers.practo.com/practo/ remained the live official Practo careers shell titled "Practo | Careers", that the page rendered current openings after the built-in public search action, and that the public Zwayam search payload for companyId MTYzMDI= returned 13 live India openings including Creative Strategist Manager, Head Customer Support, and Product Manager. The companion public detail endpoint at https://public.zwayam.com/jobs-service/v1/jobs/careersite also returned structured descriptions and qualification data for those openings, so this scraper now promotes the verified public Practo jobs contract into structured jobs.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default PRACTO_CATALOG
