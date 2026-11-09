import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROPERTY_GURU_CATALOG = {
  source: 'propertyguru',
  companyName: 'PropertyGuru',
  officialBrandName: 'PropertyGuru Group',
  adapter: 'script',
  companyCareerPage: 'https://www.propertygurugroup.com/careers/',
  officialCareersPageUrl: 'https://www.propertygurugroup.com/careers/',
  officialWorkdayBoardUrl: 'https://propertyguru.wd105.myworkdayjobs.com/en-US/PropertyGuru/',
  jobsApiUrl: 'https://propertyguru.wd105.myworkdayjobs.com/wday/cxs/propertyguru/PropertyGuru/jobs',
  verifiedIndiaLocationDescriptors: ['Bengaluru'],
  verifiedIndiaLocationFacetIds: ['8ddf56e76fde1005210b476f4bff0000'],
  verifiedIndiaJobUrl:
    'https://propertyguru.wd105.myworkdayjobs.com/en-US/PropertyGuru/job/Bengaluru/Head-of-People--Country---Function-Lead--CTPO--_JR100927',
  verifiedIndiaApplyUrl:
    'https://propertyguru.wd105.myworkdayjobs.com/en-US/PropertyGuru/job/Bengaluru/Head-of-People--Country---Function-Lead--CTPO--_JR100927/apply',
  companyDomain: 'propertygurugroup.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-location-facet',
  extractionStrategy:
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+india-location-facet+filtered-workday-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.propertygurugroup.com/careers/ was the official PropertyGuru Group careers page, that it handed applicants to the public Workday board at https://propertyguru.wd105.myworkdayjobs.com/en-US/PropertyGuru/, and that the public jobs API at https://propertyguru.wd105.myworkdayjobs.com/wday/cxs/propertyguru/PropertyGuru/jobs exposed 25 total postings plus a verified Bengaluru location facet returning 4 India roles. The live Bengaluru results included Head of People, Country & Function Lead (CTPO ), Cloud & AI Security Architect, Senior Manager - Offensive Security, and Product & AI Transformation Lead (Talent Development).',
  dryRunFile: 'propertyguru.workday/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PROPERTY_GURU_CATALOG
