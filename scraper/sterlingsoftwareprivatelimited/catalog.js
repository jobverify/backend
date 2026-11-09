import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG = {
  source: 'sterlingsoftwareprivatelimited',
  companyName: 'Sterling Software Private Limited',
  officialBrandName: 'Sterling',
  adapter: 'script',
  homepageUrl: 'https://sterlingsoftware.global/',
  companyCareerPage: 'https://sterlingsoftware.global/career/',
  atsPlatform: 'official-company-site-public-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-table-plus-public-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-page+public-opening-table+public-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'sterlingsoftware.global',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://sterlingsoftware.global/career/ was still the live first-party Sterling careers page and now rendered 2 public Chennai openings in the on-page table: Application Engineer and Java. Verified also that the public detail pages at https://sterlingsoftware.global/new/application-engineer and https://sterlingsoftware.global/new/java-architect were live and still exposed title, location, responsibilities, skills, education, and Apply now sections on the first-party sterlingsoftware.global domain.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sterlingsoftwareprivatelimited/jobs.json',
}

export default STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG
