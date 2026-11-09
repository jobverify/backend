import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENFUSION_CATALOG = {
  source: 'enfusion',
  companyName: 'Enfusion',
  officialBrandName: 'Enfusion by Clearwater',
  adapter: 'script',
  enfusionHomepageUrl: 'https://enfusion.com/',
  officialHomepageUrl: 'https://cwan.com/',
  companyCareerPage: 'https://cwan.com/company/careers/',
  companyDomain: 'cwan.com',
  officialWorkdayBoardUrl: 'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers',
  firstPartyJobsApiUrl: 'https://cwan.com/wp-content/themes/wp-clearwater/blocks/workday/api.php',
  verifiedIndiaLocationReferences: ['LOC-Bengaluru Office'],
  verifiedIndiaJobUrl:
    'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911',
  verifiedIndiaApplyUrl:
    'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911/apply',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-json-feed-with-enfusion-brand-filter',
  extractionStrategy:
    'verified-enfusion-homepage-redirect+verified-first-party-clearwater-careers-page+verified-clearwater-workday-board+verified-first-party-jobs-api+enfusion-brand-filter+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://enfusion.com/ redirects to the live Clearwater homepage at https://cwan.com/, the first-party careers surface is https://cwan.com/company/careers/, that page renders the Clearwater Workday jobs shell and its public feed is fetched from https://cwan.com/wp-content/themes/wp-clearwater/blocks/workday/api.php, and the linked public Workday board is https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers. The live first-party jobs API exposed Enfusion-branded postings in normalized descriptions, including the Bengaluru role at https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911 and its apply URL.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ENFUSION_CATALOG
