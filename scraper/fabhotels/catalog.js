import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FAB_HOTELS_CATALOG = {
  source: 'fabhotels',
  companyName: 'FabHotels',
  officialBrandName: 'FabHotels',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'fabhotels/jobs.json',
  homepageUrl: 'https://www.fabhotels.com/',
  companyCareerPage: 'https://www.fabhotels.com/careers/',
  applicationEmail: 'jobs@fabhotels.com',
  applicationUrl: 'mailto:jobs@fabhotels.com',
  verifiedRoleUrls: [
    'https://www.fabhotels.com/careers/FS-TECH-P1',
    'https://www.fabhotels.com/careers/CS-B2B-P1',
    'https://www.fabhotels.com/careers/BA-RP-P1',
    'https://www.fabhotels.com/careers/TT-TA-P4',
    'https://www.fabhotels.com/careers/UX-DD-P1',
    'https://www.fabhotels.com/careers/TA-SA-P1',
  ],
  verifiedJobDetailExampleUrl: 'https://www.fabhotels.com/careers/FS-TECH-P1',
  verifiedSecondJobDetailExampleUrl: 'https://www.fabhotels.com/careers/UX-DD-P1',
  companyDomain: 'fabhotels.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-listing-page-plus-same-domain-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-careers-listing-page+same-domain-detail-pages+first-party-email-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.fabhotels.com/ is the live official FabHotels homepage and that https://www.fabhotels.com/careers/ exposes a first-party careers listing page with six same-domain public role-detail links: https://www.fabhotels.com/careers/FS-TECH-P1, https://www.fabhotels.com/careers/CS-B2B-P1, https://www.fabhotels.com/careers/BA-RP-P1, https://www.fabhotels.com/careers/TT-TA-P4, https://www.fabhotels.com/careers/UX-DD-P1, and https://www.fabhotels.com/careers/TA-SA-P1. Verified live detail pages including https://www.fabhotels.com/careers/FS-TECH-P1, https://www.fabhotels.com/careers/UX-DD-P1, and https://www.fabhotels.com/careers/TA-SA-P1, each exposing title, department, location, relevant experience, job text, and the first-party application handoff to jobs@fabhotels.com.',
}

export default FAB_HOTELS_CATALOG
