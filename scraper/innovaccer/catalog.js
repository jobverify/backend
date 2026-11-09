import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INNOVACCER_CATALOG = {
  source: 'innovaccer',
  companyName: 'Innovaccer',
  officialBrandName: 'Innovaccer',
  adapter: 'script',
  companyCareerPage: 'https://innovaccer.com/careers',
  companyDomain: 'innovaccer.com',
  atsPlatform: 'workable',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-first-party-jobs-page-and-public-workable-widget-api',
  extractionStrategy: 'verified-first-party-careers-page+first-party-jobs-page+public-workable-widget-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersPageUrl: 'https://innovaccer.com/careers',
  officialJobsPageUrl: 'https://innovaccer.com/careers/jobs',
  workableAccountName: 'innovaccer-analytics',
  workableBoardUrl: 'https://apply.workable.com/innovaccer-analytics/',
  jobsFeedUrl: 'https://apply.workable.com/innovaccer-analytics/jobs.md',
  widgetApiUrl: 'https://apply.workable.com/api/v1/widget/accounts/innovaccer-analytics',
  dryRunFile: 'innovaccer/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on 2026-07-16 that the first-party Innovaccer careers pages at https://innovaccer.com/careers and https://innovaccer.com/careers/jobs expose public openings and hand off to the public Workable surfaces under innovaccer-analytics, including the widget API at https://apply.workable.com/api/v1/widget/accounts/innovaccer-analytics and India roles such as 4348- Software Development Engineer-III Backend (Comet).',
  modulePath: path.join(currentDir, 'script.js'),
}

export default INNOVACCER_CATALOG
