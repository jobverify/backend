import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMNET_SYSTEMS_CATALOG = {
  source: 'amnetsystems',
  companyName: 'Amnet Systems',
  officialBrandName: 'Amnet',
  adapter: 'script',
  homepageUrl: 'https://amnet.com/',
  companyCareerPage: 'https://amnet.com/life-at-amnet/',
  legacyCurrentOpeningsUrl: 'https://amnet-systems.com/about/life-at-amnet/current-openings/',
  atsPlatform: 'official-company-careers-email-only',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-legacy-route-404',
  extractionStrategy: 'verified-first-party-careers-page+email-only-current-openings+legacy-route-404',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'amnet.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://amnet.com/life-at-amnet/ remained Amnet\'s first-party careers surface, that the Current Openings section directed candidates to careers@amnet.com instead of publishing public role cards, and that the legacy route https://amnet-systems.com/about/life-at-amnet/current-openings/ returned a first-party Page not found response.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AMNET_SYSTEMS_CATALOG
