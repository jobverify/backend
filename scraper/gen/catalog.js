import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GEN_CATALOG = {
  source: 'gen',
  companyName: 'Gen',
  officialBrandName: 'Gen Digital Inc.',
  adapter: 'script',
  companyCareerPage: 'https://www.gendigital.com/us/en/life-gen/jobs/',
  officialJobsPageUrl: 'https://www.gendigital.com/us/en/life-gen/jobs/',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/gen-digital',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/gen-digital',
  companyDomain: 'gendigital.com',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'official-site-handoff-plus-public-ashby-job-board',
  extractionStrategy:
    'verified-official-jobs-page+public-ashby-job-board-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.gendigital.com/us/en/life-gen/jobs/ is the live official Gen jobs page, that its "See all open jobs" CTA hands off to the public Ashby board at https://jobs.ashbyhq.com/gen-digital, and that verified public openings included India roles such as Senior Data Platform Engineer (IND - Chennai; IND - Pune) and Technical Support Specialist (IND - Chennai).',
  dryRunFile: 'gen/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GEN_CATALOG
