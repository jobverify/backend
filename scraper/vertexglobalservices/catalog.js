import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERTEX_GLOBAL_SERVICES_CATALOG = {
  source: 'vertexglobalservices',
  companyName: 'Vertex Global Services',
  officialBrandName: 'Vertex Global Services',
  adapter: 'script',
  homepageUrl: 'https://vertexglobalservices.com/',
  companyCareerPage: 'https://vertexglobalservices.com/about/careers/',
  companyDomain: 'vertexglobalservices.com',
  atsPlatform: 'first-party-careers-page-with-contradictory-third-party-copy',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy:
    'verified-careers-page+contradictory-finovate-execor-copy+untrustworthy-open-positions+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://vertexglobalservices.com/about/careers/ was reachable as the Vertex Global Services careers route and rendered Vertex copy such as Team Unstoppables - Join Us!, but the same page mixed in unrelated Join the Finovate Family text plus execor contact/footer fragments. Because the visible openings surface is contradictory and untrustworthy, this provider stays fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'vertexglobalservices/jobs.json',
}

export default VERTEX_GLOBAL_SERVICES_CATALOG
