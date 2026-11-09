import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SUMTOTAL_SYSTEMS_CATALOG = {
  source: 'sumtotalsystems',
  companyName: 'SumTotal Systems',
  officialBrandName: 'SumTotal Systems',
  adapter: 'script',
  homepageUrl: 'https://www.sumtotalsystems.com/',
  companyCareerPage: 'https://www.sumtotalsystems.com/about',
  redirectHomepageUrl: 'https://www.cornerstoneondemand.com/',
  redirectCompanyUrl: 'https://www.cornerstoneondemand.com/company/',
  parentCareersUrl: 'https://www.cornerstoneondemand.com/careers/',
  parentOpenPositionsUrl: 'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone',
  upstreamCompanyName: 'Cornerstone',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-exact-name-redirect-plus-generic-cornerstone-careers-skip',
  extractionStrategy:
    'verified-sumtotal-root-and-about-redirects+verified-generic-cornerstone-careers-without-sumtotal-specific-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sumtotalsystems.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sumtotalsystems.com/ redirected to https://www.cornerstoneondemand.com/, that https://www.sumtotalsystems.com/about resolved to https://www.cornerstoneondemand.com/company/, and that https://www.cornerstoneondemand.com/careers/ linked applicants to https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone as a generic Cornerstone hiring surface, not a distinct SumTotal Systems public jobs surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SUMTOTAL_SYSTEMS_CATALOG
