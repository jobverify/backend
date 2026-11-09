import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, September 13, 2026 that https://www.suki.ai/careers/ is the live official Suki careers page, carries Suki AI, Inc. branding, and sends candidates to the first-party open positions surface at https://www.suki.ai/open-positions/. The first-party page module embeds the official Greenhouse board https://job-boards.greenhouse.io/embed/job_board?for=suki, and the corresponding complete public feed at https://boards-api.greenhouse.io/v1/boards/suki/jobs?content=true exposed 10 live roles. The 4 India roles were Clinical Quality Associate - II in Bengaluru, Karnataka, India; Senior SDET (Mobile-First Full Stack) in Bangalore, India; Software Engineer II - Backend in Bengaluru with the structured Suki India office; and Software Engineer III - Backend in Bangalore, India.'

export const SUKI_CATALOG = {
  source: 'suki',
  companyName: 'Suki',
  officialBrandName: 'Suki AI, Inc.',
  adapter: 'script',
  companyCareerPage: 'https://www.suki.ai/careers/',
  officialCareersPageUrl: 'https://www.suki.ai/careers/',
  officialCareersHandoffUrl: 'https://www.suki.ai/open-positions/',
  greenhouseBoardToken: 'suki',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/suki/jobs?content=true',
  companyDomain: 'suki.ai',
  atsPlatform: 'greenhouse',
  countryFilter: 'India',
  paginationStrategy: 'single-complete-greenhouse-board-feed',
  extractionStrategy:
    'verified-first-party-careers-page+verified-greenhouse-handoff+greenhouse-api+india-location-or-office-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'suki/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SUKI_CATALOG
