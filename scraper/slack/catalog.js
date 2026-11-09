import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SLACK_CATALOG = {
  source: 'slack',
  companyName: 'Slack',
  officialBrandName: 'Slack',
  adapter: 'script',
  companyCareerPage: 'https://slack.com/intl/en-in/careers',
  officialCareersPageUrl: 'https://slack.com/careers',
  companyDomain: 'slack.com',
  officialJobBoardDomain: 'salesforce.wd12.myworkdayjobs.com',
  atsPlatform: 'official-company-careers-page+public-workday-apply-links',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page+verified-india-role-links',
  extractionStrategy:
    'verified-first-party-careers-page+verified-location-filter+verified-india-role-tags+public-workday-jobposting-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'slack/jobs.json',
  verifiedOn: '2026-08-14',
  verifiedPublicJobCount: 11,
  verifiedIndiaJobCount: 1,
  verifiedSampleJobUrl: 'https://salesforce.wd12.myworkdayjobs.com/Slack/job/India---Bangalore/Technical-Success-Architect---Slack_JR356029-1',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://slack.com/careers redirects to the live first-party Slack careers page at https://slack.com/intl/en-in/careers, that the page publicly listed 11 open positions, and that its visible location filter included India - Bangalore and India - Hyderabad. Also verified that the exact-name Slack listing for Technical Success Architect - Slack is published on that first-party page with 2 locations and hands applicants to the public Workday detail page at https://salesforce.wd12.myworkdayjobs.com/Slack/job/India---Bangalore/Technical-Success-Architect---Slack_JR356029-1, whose JobPosting structured data identifies the India requisition JR356029.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SLACK_CATALOG
