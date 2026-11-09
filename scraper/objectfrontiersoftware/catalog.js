import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OBJECT_FRONTIER_SOFTWARE_CATALOG = {
  source: 'objectfrontiersoftware',
  companyName: 'Object Frontier Software',
  officialBrandName: 'Object Frontier Software',
  adapter: 'script',
  homepageUrl: 'https://www.objectfrontier.com/',
  companyCareerPage: 'https://www.objectfrontier.com/careers',
  parkedLanderUrl: 'https://www.objectfrontier.com/lander',
  companyDomain: 'objectfrontier.com',
  atsPlatform: 'parked-exact-name-domain-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-domain-redirects-to-parked-lander',
  extractionStrategy:
    'verified-homepage-and-careers-redirect-shell+verified-lander-parking-page+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that both https://www.objectfrontier.com/ and https://www.objectfrontier.com/careers returned the same exact-name redirect shell with window.location.href="/lander", and that https://www.objectfrontier.com/lander rendered a GoDaddy-style parking page with parking scripts rather than a trustworthy Object Frontier Software public jobs surface, so this provider remains fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'objectfrontiersoftware/jobs.json',
}

export default OBJECT_FRONTIER_SOFTWARE_CATALOG
