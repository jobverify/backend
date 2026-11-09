import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CROSS_COUNTRY_INFOTECH_CATALOG = {
  source: 'crosscountryinfotech',
  companyName: 'Cross Country Infotech',
  officialBrandName: 'Cross Country India',
  adapter: 'script',
  companyCareerPage: 'https://www.crosscountry.in/careers',
  companyDomain: 'crosscountry.in',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page-first-party-listings',
  extractionStrategy: 'verified-first-party-careers-shell+regex-job-card-extraction+deduped-openings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.crosscountry.in/careers was the live first-party Cross Country Infotech careers page and that it exposed public openings directly on-page, including Team Lead - BPO (Female Preferred) in Pune along with additional role snippets such as Project Manager PMO and US Healthcare Recruiter. The local scraper therefore parses the first-party listings directly from the careers shell and deduplicates repeated card clones.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'crosscountryinfotech/jobs.json',
}

export default CROSS_COUNTRY_INFOTECH_CATALOG
