import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INTERRA_INFORMATION_TECHNOLOGIES_CATALOG = {
  source: 'interrainformationtechnologies',
  companyName: 'Interra Information Technologies',
  officialBrandName: 'InterraIT',
  adapter: 'script',
  homepageUrl: 'https://interrait.com/',
  companyCareerPage: 'https://interrait.com/career/',
  openPositionsPageUrl: 'https://interrait.com/explore-open-positions/',
  kekaCareersUrl: 'https://interrait.keka.com/careers/',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-single-keka-active-jobs-feed',
  extractionStrategy: 'verified-first-party-careers-page+first-party-open-positions-keka-embed+active-keka-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'interrait.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that direct requests to https://interrait.com/career/ and https://interrait.com/explore-open-positions/ timed out from this environment, but the pinned Ferfier Technologies Keka careers surface at https://interrait.keka.com/careers/ remained accessible. Live verification on the same date confirmed https://interrait.keka.com/careers/api/organization/default/careerportalinfo matching the exact careers portal identity and https://interrait.keka.com/careers/api/embedjobs/default/active/ff171441-bd55-480d-be5e-589b516ed6aa returning 7 active public India openings including Sr Embedded Software Engineer, ETL Tester, and Data Engineer - Lakehouse & Analytics Infrastructure.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INTERRA_INFORMATION_TECHNOLOGIES_CATALOG
