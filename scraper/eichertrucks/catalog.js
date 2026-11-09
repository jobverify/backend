import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EICHER_TRUCKS_CATALOG = {
  source: 'eichertrucks',
  companyName: 'Eicher Trucks',
  officialBrandName: 'Eicher Trucks and Buses',
  adapter: 'script',
  homepageUrl: 'https://www.eichertrucksandbuses.com/',
  companyCareerPage: 'https://www.eichertrucksandbuses.com/careers',
  careersPageUrl: 'https://www.eichertrucksandbuses.com/careers',
  verifiedFirstPartyUrls: [
    'https://www.eichertrucksandbuses.com/',
    'https://www.eichertrucksandbuses.com/careers',
    'https://www.eichertrucksandbuses.com/career',
    'https://www.eichertrucksandbuses.com/jobs',
    'https://www.eichertrucksandbuses.com/current-openings',
    'https://www.eichertrucksandbuses.com/join-us',
  ],
  linkedCareerUrls: [
    'https://careers.vecv.in/',
  ],
  companyDomain: 'eichertrucksandbuses.com',
  atsPlatform: 'official-company-site-subsidiary-careers-handoff',
  countryFilter: 'India',
  paginationStrategy:
    'verified-homepage-plus-first-party-careers-page-plus-direct-job-route-and-vecv-handoff-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-vecv-handoff+verified-missing-direct-job-routes+verified-cloudflare-blocked-vecv-careers-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.eichertrucksandbuses.com/ is the live first-party Eicher Trucks and Buses homepage, that https://www.eichertrucksandbuses.com/careers is the live brand careers page with an Explore Opportunities handoff to https://careers.vecv.in/, that https://www.eichertrucksandbuses.com/career, https://www.eichertrucksandbuses.com/jobs, https://www.eichertrucksandbuses.com/current-openings, and https://www.eichertrucksandbuses.com/join-us returned 404 during live checks, and that https://careers.vecv.in/ returned a 403 Cloudflare challenge. There is no trustworthy public jobs surface for the exact company Eicher Trucks on the verified date.',
  dryRunFile: 'eichertrucks/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EICHER_TRUCKS_CATALOG
