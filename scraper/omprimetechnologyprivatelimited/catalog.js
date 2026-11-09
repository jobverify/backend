import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG = {
  source: 'omprimetechnologyprivatelimited',
  companyName: 'Omprime Technology Private Limited',
  officialBrandName: 'OMPRIME',
  adapter: 'script',
  homepageUrl: 'https://omprime.com/',
  companyCareerPage: 'https://omprime.com/careers/',
  companyDomain: 'omprime.com',
  atsPlatform: 'official-first-party-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+jobs-list-links+non-india-region-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://omprime.com/careers/ is the live first-party OMPRIME careers page and that it exposes a Jobs List with titles including Customer Support – Chat and Head of Customer Care under the visible Choose Region selector. The currently visible region is MD rather than India, so the local scraper validates the first-party page and filters the non-India listings out of the India-only contract.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG
