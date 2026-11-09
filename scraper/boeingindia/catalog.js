import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, August 13, 2026 that https://www.boeing.com/careers/ redirects to the live first-party careers site at https://jobs.boeing.com/, that https://jobs.boeing.com/search-jobs/India/185/2/1269750/22/79/50/2 currently shows the verified zero-results state with "0 results found in India" plus the first-party no-results guidance, and that previously verified detail pages such as https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928 remain the expected first-party job-description contract with Apply Now handoff to Boeing Workday when India listings are present.'

export const BOEING_INDIA_CATALOG = {
  source: 'boeingindia',
  companyName: 'Boeing India',
  officialBrandName: 'Boeing',
  adapter: 'script',
  homepageUrl: 'https://www.boeing.com/careers/',
  careersLandingUrl: 'https://jobs.boeing.com/',
  companyCareerPage: 'https://jobs.boeing.com/search-jobs/India/185/2/1269750/22/79/50/2',
  searchResultsUrl: 'https://jobs.boeing.com/search-jobs/India/185/2/1269750/22/79/50/2',
  sampleJobUrl: 'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
  companyDomain: 'jobs.boeing.com',
  atsPlatform: 'talentbrew-radancy',
  countryFilter: 'India',
  paginationStrategy: 'page-query',
  extractionStrategy: 'verified-careers-redirect+india-search-results+detail-pages+workday-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'boeingindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BOEING_INDIA_CATALOG
