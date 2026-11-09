import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EARLYSALARY_CATALOG = {
  source: 'earlysalary',
  companyName: 'EarlySalary',
  officialBrandName: 'Fibe',
  adapter: 'script',
  homepageUrl: 'https://www.earlysalary.com/',
  redirectedHomepageUrl: 'https://www.fibe.in/',
  companyCareerPage: 'https://www.fibe.in/careers/',
  legacyCareersUrl: 'https://www.earlysalary.com/careers/',
  checkedJobsRouteUrl: 'https://www.fibe.in/jobs',
  companyDomain: 'fibe.in',
  atsPlatform: 'official-company-careers-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'legacy-domain-redirect-plus-first-party-empty-careers-page-validation',
  extractionStrategy:
    'verified-earlysalary-to-fibe-redirect+verified-fibe-homepage-careers-link+verified-empty-fibe-careers-page-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.earlysalary.com/ redirects to the live first-party Fibe homepage at https://www.fibe.in/, that the homepage careers handoff points to https://www.fibe.in/careers/, and that the first-party Fibe careers page currently shows "No Jobs found" with the embedded currentjobopeningsdepts:null payload while https://www.fibe.in/jobs resolves to a first-party 404. The trustworthy public surface is therefore an official empty careers board, not a live public jobs feed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default EARLYSALARY_CATALOG
