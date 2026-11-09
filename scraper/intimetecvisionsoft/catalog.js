import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IN_TIME_TEC_VISIONSOFT_CATALOG = {
  source: 'intimetecvisionsoft',
  companyName: 'In Time Tec Visionsoft',
  officialBrandName: 'In Time Tec',
  adapter: 'script',
  homepageUrl: 'https://www.intimetec.com/',
  companyCareerPage: 'https://www.intimetec.com/careers',
  indiaJobsUrl: 'https://careers.intimetec.in/intimetec/jobslist',
  companyDomain: 'intimetec.com',
  searchApiUrl: 'https://public.zwayam.com/jobs/search',
  detailApiUrl: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  companyApiId: 'MTUxOTQ=',
  detailCompanyId: '15194',
  atsPlatform: 'first-party-careers-page-plus-zwayam-search-api',
  countryFilter: 'India',
  paginationStrategy: 'zwayam-search-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-zwayam-search-api+zwayam-job-details+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://www.intimetec.com/careers is the live first-party In Time Tec careers page, that its India Careers handoff now points to the public board at https://careers.intimetec.in/intimetec/, and that the public zwayam jobs search API at https://public.zwayam.com/jobs/search returned 25 India openings across three pages for company id MTUxOTQ=. Live sample results included Senior AI Engineer - Vision Language Models (VLM), Java Developer, and Linux Administrator, and the companion detail endpoint at https://public.zwayam.com/jobs-service/v1/jobs/careersite returned the full public job descriptions for decoded company id 15194.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'intimetecvisionsoft/jobs.json',
}

export default IN_TIME_TEC_VISIONSOFT_CATALOG
