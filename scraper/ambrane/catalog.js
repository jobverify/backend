import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://ambraneindia.com/ is the live first-party Ambrane homepage, that https://ambraneindia.com/pages/career is a live first-party empty career shell titled "Career" with no public job listings or ATS handoff, that https://ambraneindia.com/careers, https://ambraneindia.com/career, https://ambraneindia.com/jobs, https://ambraneindia.com/join-us, https://ambraneindia.com/openings, https://ambraneindia.com/pages/careers, https://ambraneindia.com/pages/jobs, and https://ambraneindia.com/pages/join-us returned 404 during live checks, and that https://ambraneindia.com/sitemap.xml did not publish a trustworthy public jobs surface. There is no trustworthy public jobs surface on the first-party Ambrane domain.'

export const AMBRANE_CATALOG = {
  source: 'ambrane',
  companyName: 'Ambrane',
  officialBrandName: 'Ambrane',
  adapter: 'script',
  homepageUrl: 'https://ambraneindia.com/',
  companyCareerPage: 'https://ambraneindia.com/pages/career',
  careerPageUrl: 'https://ambraneindia.com/pages/career',
  sitemapUrl: 'https://ambraneindia.com/sitemap.xml',
  checkedMissingRouteUrls: [
    'https://ambraneindia.com/careers',
    'https://ambraneindia.com/career',
    'https://ambraneindia.com/jobs',
    'https://ambraneindia.com/join-us',
    'https://ambraneindia.com/openings',
    'https://ambraneindia.com/pages/careers',
    'https://ambraneindia.com/pages/jobs',
    'https://ambraneindia.com/pages/join-us',
  ],
  companyDomain: 'ambraneindia.com',
  atsPlatform: 'official-company-careers-empty-shell',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-empty-career-shell-plus-common-route-404-validation',
  extractionStrategy:
    'verified-homepage+verified-empty-career-shell+verified-missing-common-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'ambrane/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AMBRANE_CATALOG
