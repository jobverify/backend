import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCALEFLEX_CATALOG = {
  source: 'scaleflex',
  companyName: 'Scaleflex',
  officialBrandName: 'Scaleflex',
  adapter: 'script',
  companyCareerPage: 'https://www.scaleflex.com/',
  companyDomain: 'scaleflex.com',
  officialHomepageUrl: 'https://www.scaleflex.com/',
  officialCareersHandoffUrl: 'https://portals.scaleflex.com/s/xJfYX5yl/en/home',
  checkedCareersRouteUrls: [
    'https://www.scaleflex.com/careers',
    'https://www.scaleflex.com/jobs',
  ],
  atsPlatform: 'official-homepage-careers-link-loading-portal',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-linked-portal-plus-common-careers-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-loading-careers-portal+verified-missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.scaleflex.com/ is the live first-party Scaleflex homepage, that its Company footer now exposes a We are Hiring handoff to https://portals.scaleflex.com/s/xJfYX5yl/en/home, that the linked first-party portal currently exposes only a loading shell rather than a trustworthy public jobs board, and that adjacent first-party routes https://www.scaleflex.com/careers and https://www.scaleflex.com/jobs returned 404 Not Found responses during live verification. There is no trustworthy public jobs surface on the verified first-party Scaleflex domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SCALEFLEX_CATALOG
