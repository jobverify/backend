import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://galaxeye.space/ is the live first-party GalaxEye homepage, that its Careers navigation resolves to the first-party job portal at https://galaxeye.space/job-portal, and that the portal explicitly hands applicants to the branded public jobs shell at https://careers.galaxeye.space/jobs/Careers. Verified that the handoff target surfaced only as the shell title "Jobs | GalaxEye" without extractable public listing content, so there is no trustworthy public jobs surface right now.'

export const GALAXEYE_CATALOG = {
  source: 'galaxeye',
  companyName: 'GalaxEye',
  officialBrandName: 'Galaxeye Space Solutions Private Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'galaxeye/jobs.json',
  homepageUrl: 'https://galaxeye.space/',
  companyCareerPage: 'https://galaxeye.space/job-portal',
  officialCareersHandoffUrl: 'https://careers.galaxeye.space/jobs/Careers',
  publicJobsShellUrl: 'https://careers.galaxeye.space/jobs/Careers',
  companyDomain: 'galaxeye.space',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-first-party-job-portal-plus-empty-public-jobs-shell',
  extractionStrategy:
    'verified-homepage+verified-job-portal-handoff+verified-shell-only-public-jobs-page-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default GALAXEYE_CATALOG
