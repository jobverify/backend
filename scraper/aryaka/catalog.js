import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ARYAKA_CATALOG = {
  source: 'aryaka',
  companyName: 'Aryaka',
  adapter: 'script',
  companyCareerPage: 'https://www.aryaka.com/careers/',
  companyDomain: 'aryaka.com',
  homepageUrl: 'https://www.aryaka.com/',
  officialCareersHandoffUrl: 'https://jobs.jobvite.com/aryaka',
  jobListingsPageUrl: 'https://jobs.jobvite.com/aryaka/jobs/viewall',
  atsPlatform: 'jobvite',
  countryFilter: 'India',
  paginationStrategy: 'verified-official-homepage-plus-careers-page-plus-jobvite-viewall-board',
  extractionStrategy:
    'verified-official-homepage+verified-careers-page+verified-jobvite-handoff+jobvite-viewall-india-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.aryaka.com/ is the live official homepage, that https://www.aryaka.com/careers/ is the current first-party careers page, that the homepage and careers page hand applicants to the public Jobvite surface at https://jobs.jobvite.com/aryaka and https://jobs.jobvite.com/aryaka/jobs/viewall, and that the verified India listings currently include UI_UX Engineer, Data Engineer, Member Technical Staff, Platform Engineer, and Architect in Bengaluru, Karnataka.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ARYAKA_CATALOG
