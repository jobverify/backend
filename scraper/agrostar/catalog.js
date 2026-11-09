import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AGROSTAR_CATALOG = {
  source: 'agrostar',
  companyName: 'AgroStar',
  adapter: 'script',
  companyCareerPage: 'https://corporate.agrostar.in/join-us',
  companyDomain: 'corporate.agrostar.in',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'official-join-us-page-plus-darwinbox-jobs-portal',
  extractionStrategy: 'verified-join-us-page+darwinbox-public-jobs-portal',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://agrostar.in/',
  officialCareersHandoffUrl: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  darwinboxOrigin: 'https://agrostar.darwinbox.in',
  darwinboxCompanyId: 'main',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that https://agrostar.in/ redirects to AgroStar’s first-party corporate site on https://corporate.agrostar.in/, that https://corporate.agrostar.in/join-us is the live public careers page, and that it links job seekers to the official Darwinbox portal at https://agrostar.darwinbox.in/ms/candidatev2/main/careers/allJobs.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AGROSTAR_CATALOG
