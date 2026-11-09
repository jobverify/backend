import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCHBANG_CATALOG = {
  source: 'schbang',
  companyName: 'Schbang',
  officialBrandName: 'Schbang',
  adapter: 'script',
  companyCareerPage: 'https://www.schbang.com/careers',
  officialCareersPageUrl: 'https://www.schbang.com/careers',
  careersPortalUrl: 'https://careers.schbang.com/jobs/Careers',
  jobOpeningsApiUrl: 'https://careers.schbang.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  companyDomain: 'schbang.com',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  verifiedPublicJobCount: 1,
  verifiedSampleJobTitle: 'Creative Strategist',
  paginationStrategy: 'official-careers-page-handoff-plus-public-zoho-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-hiring-portal-handoff+public-zoho-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.schbang.com/careers is the live exact-name first-party Schbang careers page and that its See all Openings CTA hands candidates to the official hiring portal at https://careers.schbang.com/jobs/Careers. Verified also that the public Zoho Recruit jobs API at https://careers.schbang.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite was live on the verified date and exposed the public India opening Creative Strategist in Mumbai, so this exact-name provider uses the official careers-page handoff plus the live public jobs API.',
  dryRunFile: 'schbang/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SCHBANG_CATALOG
