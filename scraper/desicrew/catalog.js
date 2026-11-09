import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 15, 2026 that https://www.desicrew.in/ is the live first-party homepage, that https://www.desicrew.in/careers/ is the live first-party careers page and current public openings index, that the legacy https://www.desicrew.in/open-job-positions/ endpoint redirects to /careers/, that the legacy open-job-position WordPress REST endpoint is no longer a usable public jobs source, and that https://www.desicrew.in/careers/qa-automation-engineer/ is a same-domain role detail page with JobPosting metadata and an apply handoff back to the careers form. The careers page currently exposes the inline apply form directly on-page instead of the older Basin-hosted form action, so the scraper accepts either verified first-party application form shape.'

export const DESI_CREW_CATALOG = {
  source: 'desicrew',
  companyName: 'Desi Crew',
  officialBrandName: 'DesiCrew',
  adapter: 'script',
  homepageUrl: 'https://www.desicrew.in/',
  careersPageUrl: 'https://www.desicrew.in/careers/',
  companyCareerPage: 'https://www.desicrew.in/careers/',
  jobsArchiveUrl: 'https://www.desicrew.in/careers/',
  jobsApiUrl: null,
  sampleJobUrl: 'https://www.desicrew.in/careers/qa-automation-engineer/',
  companyDomain: 'desicrew.in',
  atsPlatform: 'first-party-desicrew-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-role-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-careers-page+first-party-role-index+first-party-role-detail-pages-with-jobposting-metadata',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'desicrew/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DESI_CREW_CATALOG
