import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const THREE_PILLAR_GLOBAL_CATALOG = {
  source: '3pillarglobal',
  companyName: '3Pillar Global',
  officialBrandName: '3Pillar',
  adapter: 'script',
  homepageUrl: 'https://www.3pillar.ai/',
  companyCareerPage: 'https://www.3pillar.ai/careers/career-opportunities/',
  darwinboxBoardUrl: 'https://3pillar.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  jobsApiUrl: 'https://3pillar.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main',
  companyDomain: '3pillar.ai',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'public-session-darwinbox-pagination',
  extractionStrategy: 'verified-first-party-darwinbox-handoff+session-aware-public-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: 'Verified October 3, 2026: the official 3Pillar Career Opportunities page links its Darwinbox tenant at 3pillar.darwinbox.com/ms/candidatev2/main/careers/allJobs. The public session-aware Darwinbox API returns structured India jobs; the retired Lever board returns HTTP 404. Listing denial, transport errors and malformed inventory propagate instead of returning empty jobs.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default THREE_PILLAR_GLOBAL_CATALOG
