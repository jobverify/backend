import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INSTAMOJO_CATALOG = {
  source: 'instamojo',
  companyName: 'Instamojo',
  officialBrandName: 'Instamojo',
  adapter: 'script',
  companyCareerPage: 'https://www.instamojo.com/company/team/',
  homepageUrl: 'https://www.instamojo.com/',
  jobsBoardUrl: 'https://recruiterflow.com/instamojo/jobs',
  verifiedSampleJobUrl: 'https://recruiterflow.com/instamojo/jobs/137',
  atsPlatform: 'recruiterflow',
  countryFilter: 'India',
  paginationStrategy: 'official-team-page-handoff-plus-recruiterflow-window-jobslist',
  extractionStrategy: 'verified-team-page+verified-recruiterflow-board+window.jobsList',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'instamojo.com',
  dryRunFile: 'instamojo/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedPublicPostingCount: 5,
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.instamojo.com/company/team/ is the live first-party Instamojo team and careers page, that it links job seekers to the public Recruiterflow board at https://recruiterflow.com/instamojo/jobs, and that the board currently exposes five public postings with live detail routes such as https://recruiterflow.com/instamojo/jobs/137.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default INSTAMOJO_CATALOG
