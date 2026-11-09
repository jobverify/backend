import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BRIDGEI2I_ANALYTICS_SOLUTIONS_CATALOG = {
  source: 'bridgei2ianalyticssolutions',
  companyName: 'Bridgei2i Analytics Solutions',
  officialBrandName: 'BRIDGEi2i',
  adapter: 'script',
  homepageUrl: 'https://bridgei2i.com/',
  companyCareerPage: 'https://bridgei2i.com/',
  acquisitionNoticeUrl: 'https://newsroom.accenture.com/news/2021/accenture-completes-acquisition-of-bridgei2i',
  linkedParentCareersPage: 'https://www.accenture.com/us-en/careers/explore-careers/area-of-interest/ai-data-science-careers?aoi=Artificial%20Intelligence%20(AI)%20%26%20Data%20Science',
  companyDomain: 'bridgei2i.com',
  atsPlatform: 'acquired-company-domain-redirect-no-exact-jobs',
  countryFilter: 'India',
  paginationStrategy: 'redirected-homepage-plus-acquisition-notice',
  extractionStrategy: 'verified-domain-redirect-to-accenture-ai+verified-acquisition-notice+generic-parent-careers-link+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://bridgei2i.com/ resolves to a generic Accenture Artificial Intelligence and Data page that advertises Data careers plus a Search open roles link, while https://newsroom.accenture.com/news/2021/accenture-completes-acquisition-of-bridgei2i confirms BRIDGEi2i is now part of Accenture. The verified first-party and parent-company surfaces exposed no exact Bridgei2i job board or dedicated BRIDGEi2i public openings list.',
  dryRunFile: 'bridgei2ianalyticssolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BRIDGEI2I_ANALYTICS_SOLUTIONS_CATALOG
