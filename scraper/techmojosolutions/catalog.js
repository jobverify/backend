import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHMOJO_SOLUTIONS_CATALOG = {
  source: 'techmojosolutions',
  companyName: 'TechMojo Solutions',
  officialBrandName: 'TechMojo',
  adapter: 'script',
  companyCareerPage: 'https://techmojo.com/company/careers/',
  publicJobsUrl: 'https://9am.careers/',
  publicCompanyBoardUrl: 'https://9am.careers/jobs/techmojo-solutions/',
  companyDomain: 'techmojo.com',
  atsPlatform: '9am-careers-public-payload',
  countryFilter: 'India',
  paginationStrategy: 'first-party-handoff-plus-complete-9am-company-board',
  extractionStrategy: 'verified-techmojo-careers-page+company-board-jobsdata+matching-detail-payloads+explicit-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-19',
  verifiedSurfaceSummary:
    'Verified October 19, 2026: https://techmojo.com/company/careers/ links to the TechMojo 9am company board. The canonical trailing-slash URL https://9am.careers/jobs/techmojo-solutions/ now returns the complete twenty-record jobsData array; the URL without a trailing slash returns 404. The homepage has switched to featured cards. Slim board records are hydrated from matching first-party 9am job detail applyPayload records, with exact employer, identity, open status, and explicit India checks. Detail URLs include both the company slug and job slug.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'techmojosolutions/jobs.json',
}

export default TECHMOJO_SOLUTIONS_CATALOG
