import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.fastrack.in/ returns its known Cloudflare blocked page from this environment. The verified https://www.titancompany.in/careers page still covers Fastrack and links current vacancies to https://careers.titan.in/in/en/search-results. The handoff https://careers.titan.in/?rms=titan resolves to https://careers.titan.in/in/en, whose updated home page retains Titan brand and careers markers. The search results page still says Sorry... no active job openings, please come back later.'

export const FASTRACK_CATALOG = {
  source: 'fastrack',
  companyName: 'Fastrack',
  officialBrandName: 'Fastrack',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'fastrack/jobs.json',
  companyCareerPage: 'https://careers.titan.in/?rms=titan',
  companyDomain: 'fastrack.in',
  officialHomepageUrl: 'https://www.fastrack.in/',
  officialCareersHandoffUrl: 'https://careers.titan.in/?rms=titan',
  officialCareersHomeUrl: 'https://careers.titan.in/in/en',
  titanCorporateCareersUrl: 'https://www.titancompany.in/careers',
  officialSearchResultsUrl: 'https://careers.titan.in/in/en/search-results',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'brand-homepage-to-parent-careers-handoff-no-public-fastrack-jobs',
  extractionStrategy:
    'verified-fastrack-homepage+verified-footer-careers-handoff+verified-titan-brand-inclusive-careers-page+verified-titan-jobs-home+verified-zero-results-search-shell-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FASTRACK_CATALOG
