import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ANANTA_ASPEN_CENTRE_CATALOG = {
  source: 'anantaaspencentre',
  companyName: 'Ananta Aspen Centre',
  officialBrandName: 'Ananta Centre',
  adapter: 'script',
  companyCareerPage: 'https://anantacentre.in/careers/',
  homepageUrl: 'https://anantacentre.in/',
  careersPageUrl: 'https://anantacentre.in/careers/',
  legacyCareerUrl: 'https://anantacentre.in/career',
  noPublicJobRouteUrls: [
    'https://anantacentre.in/jobs',
    'https://anantacentre.in/join-us',
    'https://anantacentre.in/work-with-us',
    'https://anantacentre.in/openings',
  ],
  companyDomain: 'anantacentre.in',
  atsPlatform: 'official-company-careers-nonlisting',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-careers-form-shell-plus-common-route-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-apply-popup-form+verified-career-redirect+verified-missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://anantacentre.in/ is the live first-party Ananta Centre homepage for the backlog company name Ananta Aspen Centre and links directly to https://anantacentre.in/careers/. The first-party careers page exposes a generic Apply Now popup form with resume upload and an internship checkbox, https://anantacentre.in/career redirects to the same first-party careers page, and https://anantacentre.in/jobs, https://anantacentre.in/join-us, https://anantacentre.in/work-with-us, and https://anantacentre.in/openings returned first-party 404 pages during live checks. There is no trustworthy public jobs surface on the official first-party domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ANANTA_ASPEN_CENTRE_CATALOG
