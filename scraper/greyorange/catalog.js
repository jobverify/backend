import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GREYORANGE_CATALOG = {
  source: 'greyorange',
  companyName: 'GreyOrange',
  officialBrandName: 'GreyOrange',
  adapter: 'script',
  companyCareerPage: 'https://careers.greyorange.com/greyorange/',
  officialCareersPageUrl: 'https://careers.greyorange.com/greyorange/',
  zwayamCompanyConfigUrl: 'https://public.zwayam.com/data-service/v2/company/16090/careersite-configurations',
  zwayamSearchUrl: 'https://public.zwayam.com/jobs/search',
  zwayamJobDetailUrl: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  publicJobBaseUrl: 'https://careers.greyorange.com/greyorange/jobview',
  sampleJobUrl: 'https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963',
  companyDomain: 'greyorange.com',
  atsPlatform: 'zwayam',
  paginationStrategy: 'zwayam-search-api-with-detail-fetch',
  extractionStrategy:
    'verified-first-party-careers-page+verified-zwayam-company-config+zwayam-search-api+zwayam-detail-api+public-jobview-urls',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedJobCount: 84,
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://careers.greyorange.com/greyorange/ is the live first-party GreyOrange careers site and that GreyOrange publishes its public jobs through Zwayam. The public company configuration at https://public.zwayam.com/data-service/v2/company/16090/careersite-configurations identified companyName GreyOrange with careerSiteUrl careers.greyorange.com, the public search endpoint at https://public.zwayam.com/jobs/search returned 84 public jobs for companyId MTYwOTA= and domain careers.greyorange.com, and the public detail endpoint at https://public.zwayam.com/jobs-service/v1/jobs/careersite resolved live job detail data including Software Development Engineer in Test II at https://careers.greyorange.com/greyorange/jobview/senior-engineer-solution-qa-gurugram-hq-2026052710320963.',
  dryRunFile: 'greyorange/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GREYORANGE_CATALOG
