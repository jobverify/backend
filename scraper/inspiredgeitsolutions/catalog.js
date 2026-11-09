import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INSPIREDGE_IT_SOLUTIONS_CATALOG = {
  source: 'inspiredgeitsolutions',
  companyName: 'Inspiredge IT Solutions',
  officialBrandName: 'Inspiredge',
  adapter: 'script',
  homepageUrl: 'https://inspiredgeit.com/',
  companyCareerPage: 'https://inspiredgeit.com/jobs/',
  atsPlatform: 'official-first-party-jobs-archive',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-archive-pagination',
  extractionStrategy: 'paginated-first-party-job-cards+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'inspiredgeit.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://inspiredgeit.com/jobs/ is the live first-party Inspiredge jobs archive, that the current Simple Job Board list view spans five non-empty archive pages with 66 public role pages in total, and that the current India-relevant openings include titles such as Telecom Analyst, AI Engineer, and Technical Lead with on-page Apply Now links and locations including Remote, Hyderabad, and Visakhapatnam.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INSPIREDGE_IT_SOLUTIONS_CATALOG
