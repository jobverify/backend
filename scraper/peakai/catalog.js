import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://peak.ai/company/careers/ is the live official Peak careers landing page and links India Careers to https://peak.ai/company/careers/india/. The official India careers page renders the Our India Opportunities board with the explicit empty state "There are currently no opportunities," so no public India roles are available on the verified date.'

export const PEAK_AI_CATALOG = {
  source: 'peakai',
  companyName: 'Peak AI',
  officialBrandName: 'Peak',
  adapter: 'script',
  homepageUrl: 'https://peak.ai/',
  companyCareerPage: 'https://peak.ai/company/careers/india/',
  officialCareersLandingUrl: 'https://peak.ai/company/careers/',
  companyDomain: 'peak.ai',
  atsPlatform: 'official-company-site-empty-jobs-board',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-home-plus-india-empty-board-validation',
  extractionStrategy: 'verified-first-party-careers-home+india-opportunities-empty-state-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'peakai/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default PEAK_AI_CATALOG
