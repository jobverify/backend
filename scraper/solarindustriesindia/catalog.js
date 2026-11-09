import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOLAR_INDUSTRIES_INDIA_CATALOG = {
  source: 'solarindustriesindia',
  companyName: 'Solar Industries India',
  officialBrandName: 'Solar Group',
  legalEntityName: 'Solar Industries India Limited',
  adapter: 'script',
  companyCareerPage: 'https://careers.solargroup.com/solargroup/',
  homepageCareersEntryUrl: 'https://careers.solargroup.com/#!/',
  officialHomepageUrl: 'https://www.solargroup.com/',
  sampleJobViewUrl: 'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
  officialSearchApiUrl: 'https://public.zwayam.com/jobs/search',
  officialDetailApiUrl: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  zwayamDomain: 'careers.solargroup.com',
  zwayamCompanyId: 'MTU0Nzg=',
  zwayamDetailCompanyId: '15478',
  verifiedPublicJobCount: 4,
  verifiedSampleJobTitle: 'Sr. Executive - Navigation Engineer',
  verifiedSampleJobUrl: 'https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073',
  companyDomain: 'solargroup.com',
  atsPlatform: 'zwayam',
  countryFilter: 'India',
  paginationStrategy: 'homepage-careers-entry-plus-public-zwayam-total-count-plus-page-size',
  extractionStrategy:
    'verified-homepage-careers-entry+verified-zwayam-board-shell+verified-sample-jobview-shell+public-zwayam-search-api+detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that https://www.solargroup.com/ is the live Solar Group homepage for Solar Industries India and that its Careers navigation currently points to https://careers.solargroup.com/#!/. Verified that the first-party board shell is live at https://careers.solargroup.com/solargroup/ and that sample jobview routes such as https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073 resolve the same public Angular shell. Verified that the public Zwayam search API at https://public.zwayam.com/jobs/search accepts careers.solargroup.com with companyId MTU0Nzg=, that the public detail API at https://public.zwayam.com/jobs-service/v1/jobs/careersite resolves detail company id 15478, and that the verified search contract currently exposes 4 public records including Sr. Executive - Navigation Engineer at https://careers.solargroup.com/solargroup/jobview/sr-executive-uav-2024122016373073 even though the listing payload still carries Hidden/Closed/Limited flags.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SOLAR_INDUSTRIES_INDIA_CATALOG
