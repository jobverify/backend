import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMART_ENERGY_WATER_CATALOG = {
  source: 'smartenergywater',
  companyName: 'Smart Energy Water',
  officialBrandName: 'SEW.AI',
  adapter: 'script',
  homepageUrl: 'https://www.sew.ai/',
  companyCareerPage: 'https://www.sew.ai/sew-career',
  knownIndiaJobDetailUrl: 'https://www.sew.ai/careers/product-engineer-net',
  companyDomain: 'sew.ai',
  atsPlatform: 'first-party-careers-site-with-unenumerable-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'detail-pages-not-indexed-publicly',
  extractionStrategy:
    'verified-sew-careers-branding+verified-india-job-detail-page+no-trustworthy-public-listing-index+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.sew.ai/sew-career was the live SEW.AI careers landing page, that it marketed the SEW careers experience, and that a verified India detail page at https://www.sew.ai/careers/product-engineer-net publicly described Product Engineer- .Net in Noida (India). Because this surface does not expose a trustworthy enumerable public listing index from the first-party landing page, this provider stays fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SMART_ENERGY_WATER_CATALOG
