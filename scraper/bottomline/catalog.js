import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BOTTOMLINE_CATALOG = {
  source: 'bottomline',
  companyName: 'Bottomline',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.bottomline.com/about/careers/jobs',
  companyDomain: 'bottomline.com',
  careersUrl: 'https://www.bottomline.com/about/careers/jobs',
  jobsDataAnchor: 'const jobList =',
  atsPlatform: 'greenhouse-inline-json',
  countryFilter: 'India',
  paginationStrategy: 'single-page-inline-json',
  extractionStrategy: 'verified-first-party-page-plus-inline-joblist-india-filter',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: 'Saturday, July 18, 2026: Bottomline exposed a first-party careers page at /about/careers/jobs with a server-rendered "Current Job Openings" surface and inline jobList JSON containing India roles including "Accounting Operations Data Engineer".',
}

export default BOTTOMLINE_CATALOG
