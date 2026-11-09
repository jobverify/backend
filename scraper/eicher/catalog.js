import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EICHER_CATALOG = {
  source: 'eicher',
  companyName: 'Eicher',
  officialBrandName: 'Eicher Motors Limited',
  adapter: 'script',
  homepageUrl: 'https://www.eicher.in/',
  companyCareerPage: 'https://www.eicher.in/careers',
  careersPageUrl: 'https://www.eicher.in/careers',
  verifiedFirstPartyUrls: [
    'https://www.eicher.in/',
    'https://www.eicher.in/careers',
    'https://www.eicher.in/career',
    'https://www.eicher.in/jobs',
    'https://www.eicher.in/current-openings',
  ],
  linkedCareerUrls: [
    'http://royalenfield.com/aboutus/careers/',
    'http://careers.vecv.in/',
    'https://careers.vecv.in/',
  ],
  companyDomain: 'eicher.in',
  atsPlatform: 'official-company-site-subsidiary-careers-handoff',
  countryFilter: 'India',
  paginationStrategy:
    'verified-homepage-plus-careers-page-plus-direct-job-route-and-subsidiary-handoff-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-subsidiary-careers-handoff+verified-missing-direct-job-routes+verified-cloudflare-blocked-vecv-careers-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.eicher.in/ is the live first-party Eicher Motors homepage, that https://www.eicher.in/careers is the live first-party careers page with only subsidiary handoffs to http://royalenfield.com/aboutus/careers/ and http://careers.vecv.in/, that https://www.eicher.in/career, https://www.eicher.in/jobs, and https://www.eicher.in/current-openings returned 404 during live checks, and that https://careers.vecv.in/ returned a 403 Cloudflare challenge. There is no trustworthy public jobs surface for the exact company Eicher on the verified date.',
  dryRunFile: 'eicher/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EICHER_CATALOG
