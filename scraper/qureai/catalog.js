import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://jobs.qure.ai/ is the live official Qure.ai careers landing page and that it links public openings to the branded first-party portal at https://career.qure.ai/jobs/Careers. Verified that the public portal HTML exposes a hidden input with id="jobs" containing 13 published public roles, including 8 India roles, and that a live India detail page was publicly reachable at https://career.qure.ai/jobs/Careers/102070000016750008/IT-Infra-Engineer?source=CareerSite. The official careers landing and portal identify the employer as Qure.ai Technologies Private Limited.'

export const QURE_AI_CATALOG = {
  source: 'qureai',
  companyName: 'Qure.ai',
  officialBrandName: 'Qure.ai',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'qureai/jobs.json',
  companyCareerPage: 'https://jobs.qure.ai/',
  careersPortalUrl: 'https://career.qure.ai/jobs/Careers',
  companyDomain: 'qure.ai',
  embeddedJobsInputId: 'jobs',
  verifiedPublicJobCount: 13,
  verifiedIndiaRoleCount: 8,
  verifiedSampleIndiaJobId: '102070000016750008',
  verifiedSampleIndiaJobTitle: 'IT Infra Engineer',
  atsPlatform: 'zohorecruit-embedded',
  countryFilter: 'India',
  paginationStrategy: 'single-official-embedded-jobs-payload',
  extractionStrategy:
    'verified-first-party-careers-page+verified-zohorecruit-portal+embedded-public-jobs-payload+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default QURE_AI_CATALOG
