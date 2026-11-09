import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SANDBOXAQ_CATALOG = {
  source: 'sandboxaq',
  companyName: 'SandboxAQ',
  officialBrandName: 'SandboxAQ',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.sandboxaq.com/',
  companyCareerPage: 'https://www.sandboxaq.com/careers',
  officialCareersListUrl: 'https://www.sandboxaq.com/careers-list',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/sandboxaq',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/sandboxaq',
  atsPlatform: 'ashby',
  countryFilter: 'Global',
  paginationStrategy: 'single-public-ashby-job-board-get',
  extractionStrategy:
    'verified-first-party-careers-page+verified-careers-list-shell+verified-public-ashby-board+public-ashby-get-feed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sandboxaq.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sandboxaq.com/careers is the live official SandboxAQ careers page and routes applicants to https://www.sandboxaq.com/careers-list via View Job Openings, that the careers-list route remains a live SandboxAQ shell, that the public SandboxAQ jobs board shell exists at https://jobs.ashbyhq.com/sandboxaq, and that current public SandboxAQ job pages include Staff Machine Learning Engineer, AI Generation Engine and Product & Growth Marketer, AI Simulation. The public Ashby feed endpoint for this board is https://api.ashbyhq.com/posting-api/job-board/sandboxaq.',
  dryRunFile: 'sandboxaq/jobs.json',
}

export default SANDBOXAQ_CATALOG
