import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMAGI_MEDIA_LABS_CATALOG = {
  source: 'amagi',
  companyName: 'Amagi Media Labs',
  officialBrandName: 'Amagi',
  adapter: 'script',
  homepageUrl: 'https://www.amagi.com/',
  companyCareerPage: 'https://www.amagi.com/careers/open-roles',
  jobsBoardUrl: 'https://amagi.mynexthire.com/employer/jobs/careers',
  listingApiUrl: 'https://amagi.mynexthire.com/employer/careers/reqlist/get',
  atsPlatform: 'mynexthire',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'amagi.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.amagi.com/careers/open-roles was the live first-party Amagi careers shell, that it embedded the public board at https://amagi.mynexthire.com/employer/jobs/careers, and that the public MyNextHire listing API at https://amagi.mynexthire.com/employer/careers/reqlist/get surfaced Current Openings [18] including Marketing Operations Lead (GTM - RevOps) and QA Engineer I.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AMAGI_MEDIA_LABS_CATALOG
