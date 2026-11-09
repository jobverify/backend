import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NEXTCOMM_CORPORATION_CATALOG = {
  source: 'nextcommcorporation',
  companyName: 'NextComm Corporation',
  officialBrandName: 'NextComm Corporation',
  adapter: 'script',
  homepageUrl: 'https://www.nextcommcorporation.com/',
  companyCareerPage: 'https://www.nextcommcorporation.com/careers',
  landerUrl: 'https://www.nextcommcorporation.com/lander',
  companyDomain: 'nextcommcorporation.com',
  atsPlatform: 'official-site-parking-lander-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'homepage-and-careers-js-redirect-plus-lander-validation',
  extractionStrategy:
    'verified-homepage-js-redirect-to-godaddy-parking-lander-without-public-jobs-surface+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that both https://www.nextcommcorporation.com/ and https://www.nextcommcorporation.com/careers render the same JavaScript redirect shell sending visitors to /lander, and that https://www.nextcommcorporation.com/lander resolves to a GoDaddy parking lander rather than a trustworthy first-party careers surface. Because no trustworthy public jobs inventory is exposed from the exact company domain, this local provider is pinned as a fail-closed sentinel that returns an empty set.',
  dryRunFile: 'nextcommcorporation/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NEXTCOMM_CORPORATION_CATALOG
