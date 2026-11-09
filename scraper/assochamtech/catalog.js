import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.assocham.org/ serves a first-party frontend whose Careers navigation points to /career. The old https://www.assocham.org/career.php now returns 404, while https://www.assocham.org/assocham_backend/career.php remains a public generic profile and internship intake page with hr@assocham.com and resume-upload fields. Common /careers, /career, /jobs, /join-us, /work-with-us, and /recruitment routes return 404. There is no trustworthy public jobs surface.'

export const ASSOCHAM_TECH_CATALOG = {
  source: 'assochamtech',
  companyName: 'Assocham Tech',
  officialBrandName: 'ASSOCHAM',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'assochamtech/jobs.json',
  homepageUrl: 'https://www.assocham.org/',
  companyCareerPage: 'https://www.assocham.org/assocham_backend/career.php',
  legacyCareersUrl: 'https://www.assocham.org/career.php',
  applicationEmail: 'hr@assocham.com',
  applicationUrl: 'mailto:hr@assocham.com',
  companyDomain: 'assocham.org',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-generic-careers-intake-page-plus-common-job-route-404-validation',
  extractionStrategy:
    'verified-homepage+verified-generic-careers-intake-page-without-public-listings+verified-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ASSOCHAM_TECH_CATALOG
