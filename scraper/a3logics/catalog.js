import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const A3LOGICS_CATALOG = {
  source: 'a3logics',
  companyName: 'A3logics',
  officialBrandName: 'A3Logics',
  adapter: 'script',
  homepageUrl: 'https://www.a3logics.com/',
  companyCareerPage: 'https://www.a3logics.com/careers/',
  jobsBoardUrl: 'https://a3logics.keka.com/careers/',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'single-keka-active-jobs-feed',
  extractionStrategy: 'verified-first-party-careers-page+keka-embed-handoff+active-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'a3logics.com',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://www.a3logics.com/careers/ still links to https://a3logics.keka.com/careers/ through Explore Job opportunities. The former embedded jobs script is absent. The branded Keka tenant identifies A3LOGICS and the official company website; its current feed lists one India role, Senior System and Network Administrator in Jaipur.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default A3LOGICS_CATALOG
